import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { Repositories } from "../../db/repositories/index.js";
import type { QueryWindow } from "../signoz/client.js";
import { emitDeploymentTrace } from "./telemetry.js";
import { ConflictError, DependencyError, ValidationError } from "../../http/errors.js";

export interface RecordDeploymentInput {
  repository: string;
  commitSha: string;
  serviceName: string;
  environmentName: string;
  route: string;
  healthUrl: string;
  imageDigest: string;
  idempotencyKey: string;
  provider: string;
  role: "baseline" | "candidate" | "recovery";
  status: "started" | "succeeded" | "failed";
  deployedAt: string;
}

export interface DeploymentServiceOptions {
  exporterFactory?: () => SpanExporter;
  /**
   * Resolves the emitted marker trace. `anchorMs` is the deployment instant:
   * the marker root span is timestamped there, not at the moment of export,
   * so a window centred on "now" would miss a backdated deployment entirely.
   */
  verifyTrace?: (
    traceId: string,
    expectedSpanCount: number,
    anchorMs: number,
  ) => Promise<boolean>;
  warmupSeconds?: number;
  observedWindowSeconds?: number;
  ingestionDelaySeconds?: number;
  now?: () => number;
  /** Total wall-clock budget for observing the deployed version in SigNoz. */
  versionVisibilityTimeoutMs?: number;
  /** Total wall-clock budget for resolving the emitted marker trace. */
  traceVerificationTimeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  allowedHealthOrigins?: readonly string[];
}

type TraceState = "pending" | "exported" | "verified" | "failed";

interface DeploymentTraceOutcome {
  traceId: string | null;
  state: TraceState;
  error: string | null;
}

export class DeploymentService {
  constructor(
    private readonly repos: Repositories,
    private readonly healthCheck: (url: string) => Promise<boolean> = defaultHealthCheck,
    private readonly versionVisible: (window: QueryWindow) => Promise<boolean> = async () => false,
    private readonly ensureChange?: (commitSha: string) => Promise<void>,
    private readonly options: DeploymentServiceOptions = {},
  ) {}

  async recordDeployment(input: RecordDeploymentInput) {
    this.assertHealthOriginAllowed(input.healthUrl);

    const replay = await this.resolveReplay(input);
    if (replay) {
      return replay;
    }

    const change = await this.resolveChange(input.commitSha);

    if (input.role === "baseline" && input.status === "succeeded") {
      const existing = await this.repos.getBaselineDeployment(input.serviceName, input.environmentName);
      if (existing) {
        throw new ConflictError(
          "baseline_already_frozen",
          "A baseline deployment already exists for this service and environment",
        );
      }
    }

    let versionState: "pending" | "verified" | "failed" = "pending";
    if (input.status === "succeeded") {
      if (!await this.healthCheck(input.healthUrl)) {
        throw new DependencyError("deployment_unhealthy", "Deployment health check failed");
      }
      const visible = await this.waitForVersion({
        serviceName: input.serviceName,
        serviceVersion: input.commitSha,
        environmentName: input.environmentName,
        route: input.route,
        startMs: Date.parse(input.deployedAt),
        endMs: Math.max(Date.parse(input.deployedAt) + 1, this.now()),
      });
      if (!visible) {
        throw new DependencyError(
          "deployment_version_unverified",
          "The deployed service.version is not yet visible in SigNoz",
        );
      }
      versionState = "verified";
    }

    const deploymentId = buildDeploymentId(input);
    const readinessAt = input.status === "succeeded"
      ? new Date(this.now()).toISOString()
      : null;
    const evaluationNotBefore = readinessAt
      ? new Date(Date.parse(readinessAt) + this.evaluationDelayMs()).toISOString()
      : null;

    const trace = await this.emitTrace(input, deploymentId);

    await this.repos.insertDeployment({
      id: deploymentId,
      change_id: change.id,
      service_name: input.serviceName,
      environment_name: input.environmentName,
      role: input.role,
      status: input.status,
      deployed_at: input.deployedAt,
      emitted_trace_id: trace.traceId,
      provider: input.provider,
      idempotency_key: input.idempotencyKey,
      health_url: input.healthUrl,
      route: input.route,
      image_digest: input.imageDigest,
      readiness_at: readinessAt,
      evaluation_not_before: evaluationNotBefore,
      version_state: versionState,
      trace_state: trace.state,
      verification_error: trace.error,
      created_at: new Date(this.now()).toISOString(),
    });

    return {
      deploymentId,
      // When the measurement clock started. Recording a deployment involves
      // waiting for the version to become visible in SigNoz, which can take
      // tens of seconds, so a caller that timed its traffic from the moment the
      // request returned would fill a window that had already been open — and
      // partly closed — while it waited.
      readinessAt,
      evaluationReadyAt: evaluationNotBefore ?? input.deployedAt,
      replayed: false,
      versionState,
      traceState: trace.state,
    };
  }

  /**
   * Detects a replayed delivery of the same deployment event.
   *
   * Returns the stored outcome for an exact replay, and rejects a key reused
   * for different deployment identity or an illegal state transition.
   */
  private async resolveReplay(input: RecordDeploymentInput) {
    const existing = await this.repos.getDeploymentByIdempotencyKey(input.provider, input.idempotencyKey);
    if (!existing) {
      return null;
    }
    const existingChange = await this.repos.getChangeForDeployment(existing.id);
    const sameIdentity =
      existingChange?.commit_sha === input.commitSha &&
      existing.service_name === input.serviceName &&
      existing.environment_name === input.environmentName &&
      existing.role === input.role &&
      existing.image_digest === input.imageDigest;
    if (!sameIdentity) {
      throw new ConflictError(
        "idempotency_conflict",
        "This idempotency key was already used for a different deployment",
      );
    }
    if (existing.status === input.status) {
      return {
        deploymentId: existing.id,
        readinessAt: existing.readiness_at,
        evaluationReadyAt: existing.evaluation_not_before ?? existing.deployed_at,
        replayed: true,
        versionState: existing.version_state ?? "pending",
        traceState: existing.trace_state ?? "pending",
      };
    }
    if (existing.status !== "started") {
      throw new ConflictError(
        "deployment_state_conflict",
        `Terminal deployment state ${existing.status} cannot transition to ${input.status}`,
      );
    }
    return null;
  }

  private async resolveChange(commitSha: string) {
    const existing = await this.repos.getChangeBySha(commitSha);
    if (existing) {
      return existing;
    }
    if (this.ensureChange) {
      await this.ensureChange(commitSha);
    }
    const resolved = await this.repos.getChangeBySha(commitSha);
    if (!resolved) {
      throw new DependencyError(
        "change_unavailable",
        "The deployed commit could not be resolved from GitHub, so the deployment cannot be attributed",
      );
    }
    return resolved;
  }

  /**
   * Emits the deployment marker trace and reports what could be proved.
   *
   * The trace ID and its state are returned together so a caller cannot
   * persist a `verified` state next to a trace ID from a different attempt.
   */
  private async emitTrace(
    input: RecordDeploymentInput,
    deploymentId: string,
  ): Promise<DeploymentTraceOutcome> {
    if (!this.options.exporterFactory) {
      return {
        traceId: null,
        state: "failed",
        error: "Deployment telemetry exporter is not configured",
      };
    }
    try {
      const emitted = await emitDeploymentTrace(
        { ...input, deploymentId },
        this.options.exporterFactory(),
      );
      if (!this.options.verifyTrace) {
        return { traceId: emitted.traceId, state: "exported", error: null };
      }
      // Telemetry is not queryable the instant it is exported. Poll for the
      // ingestion delay before concluding the marker is missing, otherwise
      // every deployment records a failure that is really just lag.
      const verified = await this.pollUntil(
        () => this.options.verifyTrace!(
          emitted.traceId,
          emitted.spanCount,
          Date.parse(input.deployedAt),
        ),
        this.options.traceVerificationTimeoutMs ??
          Math.max(30_000, (this.options.ingestionDelaySeconds ?? 15) * 2_000),
      );
      return verified
        ? { traceId: emitted.traceId, state: "verified", error: null }
        : {
          traceId: emitted.traceId,
          state: "failed",
          error: "The deployment marker trace did not become visible in SigNoz within the ingestion budget",
        };
    } catch (error) {
      return {
        traceId: null,
        state: "failed",
        error: error instanceof Error ? error.message : "Deployment trace export failed",
      };
    }
  }

  private evaluationDelayMs(): number {
    return (
      (this.options.warmupSeconds ?? 15) +
      (this.options.observedWindowSeconds ?? 90) +
      (this.options.ingestionDelaySeconds ?? 15)
    ) * 1_000;
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private assertHealthOriginAllowed(healthUrl: string) {
    const allowed = this.options.allowedHealthOrigins ?? [];
    let origin: string;
    try {
      origin = new URL(healthUrl).origin;
    } catch {
      throw new ValidationError("Deployment healthUrl is not a valid URL");
    }
    if (!allowed.includes(origin)) {
      throw new ValidationError(
        `Deployment health-check origin ${origin} is not in the configured allowlist`,
      );
    }
  }

  /**
   * Polls SigNoz until the exact deployed version is observable on the route,
   * or the configured budget expires.
   */
  private waitForVersion(window: QueryWindow): Promise<boolean> {
    return this.pollUntil(
      () => this.versionVisible({ ...window, endMs: Math.max(window.startMs + 1, this.now()) }),
      this.options.versionVisibilityTimeoutMs ?? 30_000,
    );
  }

  /**
   * Retries `check` with exponential backoff until it succeeds or the budget
   * is spent. Used wherever GreenLight waits on telemetry ingestion, so the
   * waiting policy exists in exactly one place.
   */
  private async pollUntil(
    check: () => Promise<boolean>,
    budgetMs: number,
  ): Promise<boolean> {
    const sleep = this.options.sleep ?? defaultSleep;
    const deadline = this.now() + budgetMs;
    let attempt = 0;

    for (;;) {
      if (await check()) {
        return true;
      }
      const backoff = Math.min(500 * 2 ** attempt, 5_000);
      if (this.now() + backoff >= deadline) {
        return false;
      }
      await sleep(backoff);
      attempt += 1;
    }
  }
}

/** Deterministic per (commit, role, idempotency key) so replays converge. */
function buildDeploymentId(input: RecordDeploymentInput): string {
  const keyHash = createHash("sha256")
    .update(`${input.provider}:${input.idempotencyKey}`)
    .digest("hex")
    .slice(0, 12);
  return `dep_${input.commitSha.slice(0, 12)}_${input.role}_${keyHash}`;
}

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function defaultHealthCheck(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    return response.ok;
  } catch {
    return false;
  }
}

export function ensureDatabaseDirectory(databasePath: string) {
  mkdirSync(dirname(databasePath), { recursive: true });
}
