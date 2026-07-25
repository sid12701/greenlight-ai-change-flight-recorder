/**
 * Background worker runtime.
 *
 * Every state-changing integration runs here rather than inside an HTTP
 * handler. Nothing in this module has import-time side effects, so a test can
 * drive `runWorker` with an injected clock, database and dependencies.
 * The process wrapper lives in `worker.ts`.
 */
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { AppConfig } from "./config.js";
import { type Repositories, type JobRow } from "./db/repositories/index.js";
import { AppError } from "./http/errors.js";
import {
  DeploymentBodySchema,
  EvaluationBodySchema,
  SyncLatestBodySchema,
  SyncRunsBodySchema,
  parseInput,
} from "./http/schemas.js";
import { DeploymentService } from "./modules/deployments/service.js";
import { type GitHubClient } from "./modules/github/client.js";
import {
  ensureChangeFromCommit,
  syncLatestWorkflowRuns,
  syncWorkflowRuns,
} from "./modules/github/sync.js";
import { RegressionService } from "./modules/regressions/service.js";
import { type SignozClient } from "./modules/signoz/client.js";
import type { Logger } from "./observability/logger.js";

export const WORKER_SERVICE_NAME = "greenlight-worker";
const IDLE_POLL_MS = 250;

/**
 * Reads the commit a job is about, when it names one.
 *
 * Not every job kind carries a commit, and none is invented for those that do
 * not: an absent `commit_sha` means the job genuinely was not about a single
 * commit, which is more useful than a guessed one.
 */
function commitShaFromPayload(payloadJson: string): string | undefined {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    return typeof payload.commitSha === "string" ? payload.commitSha : undefined;
  } catch {
    return undefined;
  }
}
const STALE_LOCK_MS = 5 * 60_000;

export interface WorkerDependencies {
  repos: Repositories;
  config: AppConfig;
  logger: Logger;
  processJob: (job: JobRow) => Promise<unknown>;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  /** Resolves when the worker should drain and stop. */
  signal?: AbortSignal;
  /** Stop after this many loop iterations. Tests use it; production omits it. */
  maxIterations?: number;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Decides when a failed job may run again.
 *
 * Retryability comes from the error's own type, and a known-future deadline
 * comes from `retryAt` — never from pattern-matching the message text.
 */
export function scheduleRetry(
  error: unknown,
  attempts: number,
  maxAttempts: number,
  nowMs: number,
): { terminal: boolean; availableAt: string } {
  const retryable = !(error instanceof AppError) || error.retryable;
  const terminal = !retryable || attempts >= maxAttempts;
  const explicit = error instanceof AppError ? error.retryAt : undefined;
  const backoffMs = Math.min(1_000 * 2 ** Math.max(0, attempts - 1), 60_000);
  return {
    terminal,
    availableAt: explicit ?? new Date(nowMs + backoffMs).toISOString(),
  };
}

/**
 * Claims and processes jobs until the abort signal fires.
 *
 * Each job runs inside its own span and logs its outcome, so a failure is
 * diagnosable from SigNoz alone without reading the database.
 */
export async function runWorker(dependencies: WorkerDependencies): Promise<void> {
  const { repos, config, logger } = dependencies;
  const now = dependencies.now ?? Date.now;
  const sleep = dependencies.sleep ?? delay;
  const tracer = trace.getTracer(WORKER_SERVICE_NAME);

  await repos.recoverStaleJobs(new Date(now() - STALE_LOCK_MS).toISOString());

  let iterations = 0;
  while (!dependencies.signal?.aborted) {
    if (dependencies.maxIterations !== undefined && iterations >= dependencies.maxIterations) {
      return;
    }
    iterations += 1;

    const job = await repos.claimNextJob(new Date(now()).toISOString());
    if (!job) {
      await sleep(IDLE_POLL_MS);
      continue;
    }

    // A reader investigating an incident arrives holding a commit, not a job
    // id, so jobs that name one carry it on their logs and spans.
    const commitSha = commitShaFromPayload(job.payload_json);
    const jobLogger = logger.child({
      job_id: job.id,
      job_kind: job.kind,
      attempt: job.attempts,
      ...(commitSha ? { commit_sha: commitSha } : {}),
    });
    await tracer.startActiveSpan(`job ${job.kind}`, async (span) => {
      span.setAttributes({
        "greenlight.job.id": job.id,
        "greenlight.job.kind": job.kind,
        "greenlight.job.attempt": job.attempts,
        ...(commitSha ? { "greenlight.commit.sha": commitSha } : {}),
      });
      const startedAt = now();
      try {
        const result = await withDeadline(
          dependencies.processJob(job),
          config.GREENLIGHT_JOB_DEADLINE_MS,
          `Job exceeded its ${config.GREENLIGHT_JOB_DEADLINE_MS}ms deadline`,
        );
        await repos.completeJob(job.id, new Date(now()).toISOString(), result);
        span.setStatus({ code: SpanStatusCode.OK });
        jobLogger.info("job succeeded", { duration_ms: now() - startedAt });
      } catch (error) {
        const { terminal, availableAt } = scheduleRetry(
          error,
          job.attempts,
          config.GREENLIGHT_JOB_MAX_ATTEMPTS,
          now(),
        );
        const message = error instanceof Error ? error.message : "Worker job failed";
        await repos.failJob(job.id, message, availableAt, terminal);
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        if (error instanceof Error) {
          span.recordException(error);
        }
        jobLogger.error(terminal ? "job failed permanently" : "job failed and will retry", {
          duration_ms: now() - startedAt,
          error_code: error instanceof AppError ? error.code : "unknown",
          retry_at: terminal ? null : availableAt,
          err: error,
        });
      } finally {
        span.end();
      }
    });
  }
}

/** Bounds a job so one stuck dependency cannot hold the worker forever. */
async function withDeadline<T>(
  work: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/** Wires the concrete integrations a production worker uses. */
export function buildJobProcessor(input: {
  repos: Repositories;
  config: AppConfig;
  signoz: SignozClient;
  github: GitHubClient;
}): (job: JobRow) => Promise<unknown> {
  const { repos, config, signoz, github } = input;

  const exporterFactory = () => new OTLPTraceExporter({
    url: `${config.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
  });

  // Reconstructed spans carry the workflow's own timestamps, so verification
  // is bounded by that workflow's real time range plus an ingestion margin.
  const ingestionMarginMs = (config.GREENLIGHT_INGESTION_DELAY_SECONDS + 60) * 1_000;

  /**
   * Confirms the exported trace tree is queryable, allowing for ingestion.
   *
   * Spans become visible only after the collector has written them, which takes
   * seconds. Checking once immediately after export therefore answered "not
   * visible" every time, and every reconstructed CI run was recorded as a failed
   * export while its trace sat in SigNoz perfectly intact. Polling to a deadline
   * distinguishes the two states this is meant to tell apart: a trace that never
   * arrived, and one that had not arrived *yet*.
   */
  const verifyExport = async (
    traceId: string,
    expectedSpanCount: number,
    startMs: number,
    endMs: number,
  ) => {
    const deadline = Date.now() + config.GREENLIGHT_INGESTION_DELAY_SECONDS * 1_000 + 30_000;
    for (;;) {
      const visible = await signoz.verifyTrace({
        traceId,
        expectedSpanCount,
        startMs: Math.max(0, startMs - ingestionMarginMs),
        endMs: Math.max(startMs + 1, endMs + ingestionMarginMs),
      });
      if (visible || Date.now() >= deadline) {
        return visible;
      }
      await delay(3_000);
    }
  };

  // The window spans from the deployment instant (which may be in the past)
  // through now, plus an ingestion margin at both ends.
  const verifyDeploymentTrace = (
    traceId: string,
    expectedSpanCount: number,
    anchorMs: number,
  ) => signoz.verifyTrace({
    traceId,
    expectedSpanCount,
    startMs: Math.max(0, Math.min(anchorMs, Date.now()) - ingestionMarginMs),
    endMs: Date.now() + ingestionMarginMs,
  });

  const verifyAiSpan = (
    context: { traceId: string; spanId: string },
    committedAt: string | null,
  ) => {
    const anchor = committedAt ? Date.parse(committedAt) : Date.now();
    const dayMs = 24 * 60 * 60 * 1_000;
    return signoz.verifyTrace({
      traceId: context.traceId,
      spanId: context.spanId,
      expectedServiceName: config.CLAUDE_OTEL_SERVICE_NAME,
      startMs: Math.max(0, anchor - dayMs),
      endMs: anchor + dayMs,
    });
  };

  const ensureChange = async (commitSha: string) => {
    await ensureChangeFromCommit({
      repos,
      github,
      repository: config.GITHUB_REPOSITORY,
      commitSha,
      defaultBranch: config.GREENLIGHT_DEMO_BRANCH,
    });
  };

  const deployments = new DeploymentService(
    repos,
    undefined,
    (window) => signoz.isVersionVisible(window),
    ensureChange,
    {
      exporterFactory,
      verifyTrace: verifyDeploymentTrace,
      warmupSeconds: config.GREENLIGHT_WARMUP_SECONDS,
      observedWindowSeconds: config.GREENLIGHT_OBSERVED_WINDOW_SECONDS,
      ingestionDelaySeconds: config.GREENLIGHT_INGESTION_DELAY_SECONDS,
      versionVisibilityTimeoutMs: config.GREENLIGHT_VERSION_VISIBILITY_TIMEOUT_MS,
      traceVerificationTimeoutMs: config.GREENLIGHT_VERSION_VISIBILITY_TIMEOUT_MS,
      allowedHealthOrigins: config.GREENLIGHT_HEALTH_ALLOWED_ORIGINS,
    },
  );
  const regressions = new RegressionService(repos, signoz, config);

  const syncOptions = {
    repos,
    github,
    repository: config.GITHUB_REPOSITORY,
    primaryWorkflowId: config.GREENLIGHT_PRIMARY_WORKFLOW_ID,
    defaultBranch: config.GREENLIGHT_DEMO_BRANCH,
    exporterFactory,
    verifyExport,
    verifyAiSpan,
  };

  return async (job: JobRow) => {
    switch (job.kind) {
      case "github_sync_runs": {
        const body = parseInput(SyncRunsBodySchema, JSON.parse(job.payload_json));
        return syncWorkflowRuns({
          ...syncOptions,
          runIds: body.runIds,
          primaryWorkflowName:
            body.primaryWorkflowName ?? config.GREENLIGHT_PRIMARY_WORKFLOW_NAME,
        });
      }
      case "github_sync_latest": {
        const body = parseInput(SyncLatestBodySchema, JSON.parse(job.payload_json));
        return syncLatestWorkflowRuns({
          ...syncOptions,
          branch: body.branch ?? config.GREENLIGHT_DEMO_BRANCH,
          primaryWorkflowName:
            body.primaryWorkflowName ?? config.GREENLIGHT_PRIMARY_WORKFLOW_NAME,
        });
      }
      case "deployment_record":
        return deployments.recordDeployment(
          parseInput(DeploymentBodySchema, JSON.parse(job.payload_json)),
        );
      case "regression_evaluate":
        return regressions.evaluate(
          parseInput(EvaluationBodySchema, JSON.parse(job.payload_json)),
        );
    }
  };
}
