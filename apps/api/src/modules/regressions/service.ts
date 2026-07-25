import { createHash } from "node:crypto";
import type { AppConfig } from "../../config.js";
import type {
  BaselineSnapshotRow,
  DeploymentRow,
  EvaluationWindowRow,
  EvidenceLinkRow,
  RegressionIncidentRow,
  Repositories,
} from "../../db/repositories/index.js";
import { ConflictError, DependencyError, RetryAfterError } from "../../http/errors.js";
import { SignozIntegrationError, type SignozClient, type WindowMetrics } from "../signoz/client.js";
import { recordRegressionVerdict } from "../../observability/metrics.js";
import {
  DEFAULT_THRESHOLDS,
  evaluateRegression,
  type ComparableMetrics,
  type EvaluationResult,
  type RegressionThresholds,
} from "./evaluator.js";
import {
  BaselineRequiredError,
  resolveBaselineDeployment,
  validateBaselineOrdering,
} from "./baseline-resolver.js";

export interface EvaluationRequest {
  deploymentId: string;
  baselineDeploymentId?: string;
  incidentId?: string;
  route: string;
  comparisonKind?: "deployment" | "recovery";
}

interface ResolvedComparison {
  baseline: DeploymentRow;
  snapshot: BaselineSnapshotRow;
  incident?: RegressionIncidentRow;
}

const POLICY_VERSION = "v1";

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export class RegressionService {
  constructor(
    private readonly repos: Repositories,
    private readonly signoz: SignozClient,
    private readonly config: AppConfig,
    private readonly now: () => number = Date.now,
  ) {}

  async evaluate(request: EvaluationRequest) {
    const observed = await this.repos.getDeploymentById(request.deploymentId);
    if (!observed) {
      throw new BaselineRequiredError("Observed deployment was not found");
    }
    await this.assertVerifiedDeployment(observed);

    const comparisonKind = request.comparisonKind ?? "deployment";
    const kind = comparisonKind === "recovery" ? "recovery" : "candidate";
    const thresholds: RegressionThresholds = {
      ...DEFAULT_THRESHOLDS,
      minSpans: this.config.GREENLIGHT_MIN_SPANS,
    };

    const { baseline, snapshot, incident } = comparisonKind === "recovery"
      ? await this.resolveRecovery(request, observed)
      : await this.resolveCandidate(request, observed, thresholds);

    validateBaselineOrdering(baseline, observed);
    const observedChange = await this.repos.getChangeForDeployment(observed.id);
    if (!observedChange) {
      throw new BaselineRequiredError("Observed deployment change is missing");
    }

    const window = await this.resolveObservedWindow(
      observed,
      snapshot,
      observedChange.commit_sha,
      request.route,
      kind,
    );
    const notBeforeMs = Date.parse(window.not_before);
    if (this.now() < notBeforeMs) {
      throw new RetryAfterError(
        "evaluation_window_incomplete",
        "The observed evaluation window has not finished yet",
        new Date(notBeforeMs).toISOString(),
      );
    }

    const evaluationId = `eval_${observed.id}_${kind}_${shortHash(request.route)}`;
    const scope = {
      serviceName: window.service_name,
      serviceVersion: window.service_version,
      environmentName: window.environment_name,
      route: window.route,
      startMs: Date.parse(window.window_start),
      endMs: Date.parse(window.window_end),
    };

    let observedMetrics: WindowMetrics;
    try {
      observedMetrics = await this.signoz.queryWindow(scope);
    } catch (error) {
      // SigNoz could not answer. That is an integration failure, never a
      // verdict: persist it as such and expose no metrics or evidence.
      return this.persistIntegrationError({
        evaluationId,
        observed,
        baseline,
        snapshot,
        window,
        comparisonKind,
        thresholds,
        error,
      });
    }

    const evaluation = evaluateRegression({
      comparisonKind,
      baseline: snapshotMetrics(snapshot),
      observed: toComparable(observedMetrics),
      thresholds,
    });

    const dashboardUrl = this.signoz.buildDashboardUrl(scope);
    const evidence = await this.collectEvidence({
      evaluationId,
      evaluation,
      scope,
      dashboardUrl,
    });

    const incidentId = incident?.id ??
      (evaluation.status === "regressed"
        ? `incident_${observed.id}_${shortHash(request.route)}`
        : null);
    const evaluatedAt = new Date(this.now()).toISOString();

    await this.repos.transaction(async (tx) => {
      if (incidentId && evaluation.status === "regressed" && !incident) {
        await tx.insertIncident({
          id: incidentId,
          candidate_deployment_id: observed.id,
          baseline_snapshot_id: snapshot.id,
          recovery_deployment_id: null,
          service_name: observed.service_name,
          environment_name: observed.environment_name,
          route: request.route,
          status: "open",
          opened_at: evaluatedAt,
          recovered_at: null,
        });
      }
      if (incident && comparisonKind === "recovery") {
        await tx.insertIncident({
          ...incident,
          recovery_deployment_id: observed.id,
          status: evaluation.status === "recovered" ? "recovered" : "recovery_pending",
          recovered_at: evaluation.status === "recovered" ? evaluatedAt : null,
        });
      }
      await tx.insertRegressionEvaluation({
        id: evaluationId,
        deployment_id: observed.id,
        baseline_deployment_id: baseline.id,
        baseline_snapshot_id: snapshot.id,
        evaluation_window_id: window.id,
        incident_id: incidentId,
        route: request.route,
        comparison_kind: comparisonKind,
        baseline_service_version: snapshot.service_version,
        observed_service_version: window.service_version,
        baseline_start: snapshot.window_start,
        baseline_end: snapshot.window_end,
        observed_start: window.window_start,
        observed_end: window.window_end,
        baseline_request_count: evaluation.baselineRequestCount,
        observed_request_count: evaluation.observedRequestCount,
        baseline_p90_ms: evaluation.baselineP90Ms,
        observed_p90_ms: evaluation.observedP90Ms,
        baseline_p95_ms: evaluation.baselineP95Ms,
        observed_p95_ms: evaluation.observedP95Ms,
        latency_delta_pct: evaluation.latencyDeltaPct,
        baseline_error_rate: evaluation.baselineErrorRate,
        observed_error_rate: evaluation.observedErrorRate,
        thresholds_json: JSON.stringify(evaluation.thresholds),
        policy_version: POLICY_VERSION,
        status: evaluation.status,
        reasons_json: JSON.stringify(evaluation.reasons),
        integration_error_code: null,
        signoz_dashboard_url: dashboardUrl,
        evaluated_at: evaluatedAt,
      });
      await tx.replaceEvidenceLinks(evaluationId, evidence);
    });

    // Recorded after the transaction commits, so the counter can only ever
    // describe a verdict that was actually persisted.
    recordRegressionVerdict({
      status: evaluation.status,
      comparisonKind,
      route: request.route,
    });

    return { ...evaluation, evaluationId, incidentId, evidenceLinks: evidence };
  }

  /**
   * Builds the evidence set for an evaluation.
   *
   * A link is only marked `verified` after the referenced trace has been
   * resolved in SigNoz. Anything we cannot resolve is recorded as `failed`
   * and its URL is withheld by the receipt.
   */
  private async collectEvidence(input: {
    evaluationId: string;
    evaluation: EvaluationResult;
    scope: Parameters<SignozClient["querySlowTraceIds"]>[0];
    dashboardUrl: string | null;
  }): Promise<EvidenceLinkRow[]> {
    const createdAt = new Date(this.now()).toISOString();
    const links: EvidenceLinkRow[] = [];

    if (input.dashboardUrl) {
      links.push({
        id: `${input.evaluationId}_dashboard`,
        regression_evaluation_id: input.evaluationId,
        kind: "signoz_dashboard",
        label: "Deployment Impact dashboard",
        url: input.dashboardUrl,
        ordinal: 0,
        // The dashboard is a configured identifier, not a queried artefact;
        // it is presented as configured rather than claimed as verified.
        verification_state: "pending",
        verified_at: null,
        created_at: createdAt,
      });
    }

    if (input.evaluation.status === "insufficient_data") {
      return links;
    }

    // Slow traces are supporting evidence; their absence must not turn a
    // completed evaluation into a failure.
    const traceIds = await this.signoz.querySlowTraceIds(input.scope, 3).catch(() => null);
    if (traceIds === null) {
      return links;
    }

    for (const [index, traceId] of traceIds.entries()) {
      // A trace we cannot resolve is recorded as failed, never as verified.
      const resolved = await this.signoz.verifyTrace({
        traceId,
        startMs: input.scope.startMs,
        endMs: input.scope.endMs,
      }).catch(() => false);
      links.push({
        id: `${input.evaluationId}_trace_${index + 1}`,
        regression_evaluation_id: input.evaluationId,
        kind: "signoz_trace",
        label: `Slow trace ${index + 1}`,
        url: this.signoz.buildTraceUrl(traceId),
        ordinal: index + 1,
        verification_state: resolved ? "verified" : "failed",
        verified_at: resolved ? createdAt : null,
        created_at: createdAt,
      });
    }
    return links;
  }

  private async persistIntegrationError(input: {
    evaluationId: string;
    observed: DeploymentRow;
    baseline: DeploymentRow;
    snapshot: BaselineSnapshotRow;
    window: EvaluationWindowRow;
    comparisonKind: "deployment" | "recovery";
    thresholds: RegressionThresholds;
    error: unknown;
  }) {
    const code = input.error instanceof SignozIntegrationError
      ? input.error.code
      : "signoz_integration_error";
    const message = input.error instanceof Error ? input.error.message : "SigNoz query failed";
    const evaluatedAt = new Date(this.now()).toISOString();

    await this.repos.transaction(async (tx) => {
      await tx.insertRegressionEvaluation({
        id: input.evaluationId,
        deployment_id: input.observed.id,
        baseline_deployment_id: input.baseline.id,
        baseline_snapshot_id: input.snapshot.id,
        evaluation_window_id: input.window.id,
        incident_id: null,
        route: input.window.route,
        comparison_kind: input.comparisonKind,
        baseline_service_version: input.snapshot.service_version,
        observed_service_version: input.window.service_version,
        baseline_start: input.snapshot.window_start,
        baseline_end: input.snapshot.window_end,
        observed_start: input.window.window_start,
        observed_end: input.window.window_end,
        baseline_request_count: null,
        observed_request_count: null,
        baseline_p90_ms: null,
        observed_p90_ms: null,
        baseline_p95_ms: null,
        observed_p95_ms: null,
        latency_delta_pct: null,
        baseline_error_rate: null,
        observed_error_rate: null,
        thresholds_json: JSON.stringify(input.thresholds),
        policy_version: POLICY_VERSION,
        status: "integration_error",
        reasons_json: JSON.stringify([message]),
        integration_error_code: code,
        signoz_dashboard_url: null,
        evaluated_at: evaluatedAt,
      });
      await tx.replaceEvidenceLinks(input.evaluationId, []);
    });

    // An integration failure is a recorded outcome too. Counting it keeps the
    // verdict totals honest: without it, the series would imply SigNoz always
    // answered.
    recordRegressionVerdict({
      status: "integration_error",
      comparisonKind: input.comparisonKind,
      route: input.window.route,
    });

    throw new DependencyError(code, message);
  }

  private async resolveCandidate(
    request: EvaluationRequest,
    observed: DeploymentRow,
    thresholds: RegressionThresholds,
  ): Promise<ResolvedComparison> {
    const baseline = resolveBaselineDeployment(
      await this.repos.listBaselineDeployments(observed.service_name, observed.environment_name),
      request.baselineDeploymentId,
    );
    await this.assertVerifiedDeployment(baseline);
    const existing = await this.repos.getBaselineSnapshotForDeployment(baseline.id, request.route);
    const snapshot = existing ?? await this.captureBaseline(baseline, request.route, thresholds);
    return { baseline, snapshot };
  }

  private async resolveRecovery(
    request: EvaluationRequest,
    observed: DeploymentRow,
  ): Promise<ResolvedComparison> {
    if (!request.incidentId) {
      throw new BaselineRequiredError("Recovery requires an explicit regression incident");
    }
    const incident = await this.repos.getIncidentById(request.incidentId);
    if (!incident) {
      throw new BaselineRequiredError("Regression incident was not found");
    }
    if (
      incident.service_name !== observed.service_name ||
      incident.environment_name !== observed.environment_name ||
      incident.route !== request.route
    ) {
      throw new BaselineRequiredError("Recovery deployment does not match the incident scope");
    }
    const snapshot = await this.repos.getBaselineSnapshot(incident.baseline_snapshot_id);
    if (!snapshot) {
      throw new BaselineRequiredError("Incident baseline snapshot is missing");
    }
    const baseline = await this.repos.getDeploymentById(snapshot.deployment_id);
    if (!baseline) {
      throw new BaselineRequiredError("Baseline deployment is missing");
    }
    await this.assertVerifiedDeployment(baseline);
    return { baseline, snapshot, incident };
  }

  /**
   * Captures the immutable baseline once. Every later comparison — including
   * recovery — reuses this snapshot by ID rather than re-querying, so the
   * baseline a verdict was measured against can never drift.
   */
  private async captureBaseline(
    deployment: DeploymentRow,
    route: string,
    thresholds: RegressionThresholds,
  ): Promise<BaselineSnapshotRow> {
    const change = await this.repos.getChangeForDeployment(deployment.id);
    if (!change || !deployment.readiness_at) {
      throw new BaselineRequiredError("Verified baseline identity/readiness is missing");
    }
    const startMs = Date.parse(deployment.readiness_at) +
      this.config.GREENLIGHT_WARMUP_SECONDS * 1_000;
    const endMs = startMs + this.config.GREENLIGHT_BASELINE_WINDOW_SECONDS * 1_000;
    const notBeforeMs = endMs + this.config.GREENLIGHT_INGESTION_DELAY_SECONDS * 1_000;
    if (this.now() < notBeforeMs) {
      throw new RetryAfterError(
        "baseline_window_incomplete",
        "The baseline window has not finished yet",
        new Date(notBeforeMs).toISOString(),
      );
    }

    const metrics = await this.signoz.queryWindow({
      serviceName: deployment.service_name,
      serviceVersion: change.commit_sha,
      environmentName: deployment.environment_name,
      route,
      startMs,
      endMs,
    });
    if (
      metrics.requestCount === null ||
      metrics.p90Ms === null ||
      metrics.p95Ms === null ||
      metrics.errorRatePercent === null
    ) {
      throw new ConflictError(
        "baseline_metrics_missing",
        "SigNoz reported no complete metrics for the baseline window",
      );
    }
    if (metrics.requestCount < thresholds.minSpans) {
      throw new ConflictError(
        "baseline_sample_floor_unmet",
        `Baseline window contains ${metrics.requestCount} spans, below the configured floor of ${thresholds.minSpans}`,
      );
    }

    const snapshot: BaselineSnapshotRow = {
      id: `baseline_${deployment.id}_${shortHash(route)}`,
      deployment_id: deployment.id,
      service_name: deployment.service_name,
      service_version: change.commit_sha,
      environment_name: deployment.environment_name,
      route,
      window_start: new Date(startMs).toISOString(),
      window_end: new Date(endMs).toISOString(),
      request_count: metrics.requestCount,
      p90_ms: metrics.p90Ms,
      p95_ms: metrics.p95Ms,
      error_rate: metrics.errorRatePercent,
      thresholds_json: JSON.stringify(thresholds),
      captured_at: new Date(this.now()).toISOString(),
    };
    await this.repos.insertBaselineSnapshot(snapshot);
    return snapshot;
  }

  /** Returns the persisted window, creating it on first use. */
  private async resolveObservedWindow(
    deployment: DeploymentRow,
    snapshot: BaselineSnapshotRow,
    version: string,
    route: string,
    kind: "candidate" | "recovery",
  ): Promise<EvaluationWindowRow> {
    const existing = await this.repos.getEvaluationWindow(deployment.id, kind, route);
    if (existing) {
      return existing;
    }
    if (!deployment.readiness_at) {
      throw new ConflictError("deployment_not_ready", "Deployment readiness is not verified");
    }
    const startMs = Date.parse(deployment.readiness_at) +
      this.config.GREENLIGHT_WARMUP_SECONDS * 1_000;
    const endMs = startMs + this.config.GREENLIGHT_OBSERVED_WINDOW_SECONDS * 1_000;
    const window: EvaluationWindowRow = {
      id: `window_${deployment.id}_${kind}_${shortHash(route)}`,
      deployment_id: deployment.id,
      baseline_snapshot_id: snapshot.id,
      kind,
      service_name: deployment.service_name,
      service_version: version,
      environment_name: deployment.environment_name,
      route,
      window_start: new Date(startMs).toISOString(),
      window_end: new Date(endMs).toISOString(),
      not_before: new Date(
        endMs + this.config.GREENLIGHT_INGESTION_DELAY_SECONDS * 1_000,
      ).toISOString(),
      created_at: new Date(this.now()).toISOString(),
    };
    await this.repos.insertEvaluationWindow(window);
    // The insert is a no-op if a concurrent evaluation created the window
    // first; re-reading returns whichever row actually persisted.
    return (await this.repos.getEvaluationWindow(deployment.id, kind, route)) ?? window;
  }

  private async assertVerifiedDeployment(deployment: DeploymentRow) {
    if (
      deployment.status !== "succeeded" ||
      deployment.version_state !== "verified" ||
      !deployment.readiness_at
    ) {
      throw new ConflictError(
        "deployment_not_verified",
        "Deployment must be healthy and version-verified before evaluation",
      );
    }
  }
}

function snapshotMetrics(snapshot: BaselineSnapshotRow): ComparableMetrics {
  return {
    requestCount: snapshot.request_count,
    p90Ms: snapshot.p90_ms,
    p95Ms: snapshot.p95_ms,
    errorRatePercent: snapshot.error_rate,
  };
}

function toComparable(metrics: WindowMetrics): ComparableMetrics {
  return {
    requestCount: metrics.requestCount,
    p90Ms: metrics.p90Ms,
    p95Ms: metrics.p95Ms,
    errorRatePercent: metrics.errorRatePercent,
  };
}
