import type { RegressionStatus } from "@greenlight/shared";
import type { SignozQueryResult } from "../signoz/client.js";

export interface RegressionThresholds {
  latencyMultiplier: number;
  latencyAdditiveMs: number;
  errorRateDeltaPct: number;
  errorRateAbsolutePct: number;
  minSpans: number;
  recoveryLatencyMultiplier: number;
  recoveryErrorRateDeltaPct: number;
}

export const DEFAULT_THRESHOLDS: RegressionThresholds = {
  latencyMultiplier: 1.5,
  latencyAdditiveMs: 250,
  errorRateDeltaPct: 2,
  errorRateAbsolutePct: 5,
  minSpans: 200,
  recoveryLatencyMultiplier: 1.2,
  recoveryErrorRateDeltaPct: 1,
};

export interface EvaluationInput {
  baseline: SignozQueryResult;
  observed: SignozQueryResult;
  comparisonKind: "deployment" | "recovery";
  thresholds?: RegressionThresholds;
}

export interface EvaluationResult {
  status: RegressionStatus;
  reasons: string[];
  baselineRequestCount: number | null;
  observedRequestCount: number | null;
  baselineP95Ms: number | null;
  observedP95Ms: number | null;
  baselineP90Ms: number | null;
  observedP90Ms: number | null;
  baselineErrorRate: number | null;
  observedErrorRate: number | null;
  latencyDeltaPct: number | null;
  correlationNote: string;
  thresholds: RegressionThresholds;
}

export function evaluateRegression(input: EvaluationInput): EvaluationResult {
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;
  const reasons: string[] = [];
  const correlationNote =
    "Deployment correlation is evidence of temporal and version association, not proof that every observed failure was caused by the commit.";

  if (input.baseline.integrationError || input.observed.integrationError) {
    return {
      status: "insufficient_data",
      reasons: ["SigNoz integration error prevented evaluation"],
      baselineRequestCount: input.baseline.requestCount,
      observedRequestCount: input.observed.requestCount,
      baselineP95Ms: input.baseline.p95Ms,
      observedP95Ms: input.observed.p95Ms,
      baselineP90Ms: input.baseline.p90Ms,
      observedP90Ms: input.observed.p90Ms,
      baselineErrorRate: input.baseline.errorRate,
      observedErrorRate: input.observed.errorRate,
      latencyDeltaPct: null,
      correlationNote,
      thresholds,
    };
  }

  const baselineCount = input.baseline.requestCount ?? 0;
  const observedCount = input.observed.requestCount ?? 0;
  if (baselineCount < thresholds.minSpans || observedCount < thresholds.minSpans) {
    reasons.push(`Fewer than ${thresholds.minSpans} completed spans in one or both windows`);
    return {
      status: "insufficient_data",
      reasons,
      baselineRequestCount: input.baseline.requestCount,
      observedRequestCount: input.observed.requestCount,
      baselineP95Ms: input.baseline.p95Ms,
      observedP95Ms: input.observed.p95Ms,
      baselineP90Ms: input.baseline.p90Ms,
      observedP90Ms: input.observed.p90Ms,
      baselineErrorRate: input.baseline.errorRate,
      observedErrorRate: input.observed.errorRate,
      latencyDeltaPct: null,
      correlationNote,
      thresholds,
    };
  }

  const baselineP95 = input.baseline.p95Ms ?? 0;
  const observedP95 = input.observed.p95Ms ?? 0;
  const latencyDeltaPct = baselineP95 === 0 ? null : ((observedP95 - baselineP95) / baselineP95) * 100;
  const latencyRegressed =
    observedP95 > baselineP95 * thresholds.latencyMultiplier &&
    observedP95 > baselineP95 + thresholds.latencyAdditiveMs;

  const baselineError = input.baseline.errorRate ?? 0;
  const observedError = input.observed.errorRate ?? 0;
  const errorRegressed =
    observedError >= baselineError + thresholds.errorRateDeltaPct &&
    observedError >= thresholds.errorRateAbsolutePct;

  if (input.comparisonKind === "recovery") {
    const recoveredLatency = observedP95 <= baselineP95 * thresholds.recoveryLatencyMultiplier;
    const recoveredError = observedError <= baselineError + thresholds.recoveryErrorRateDeltaPct;
    if (recoveredLatency && recoveredError) {
      reasons.push("Observed latency and error rate returned within recovery bounds versus the original good baseline");
      return buildResult("recovered", reasons, input, latencyDeltaPct, thresholds, correlationNote);
    }
    if (latencyRegressed || errorRegressed) {
      reasons.push("Recovery deployment still exceeds regression thresholds");
      return buildResult("regressed", reasons, input, latencyDeltaPct, thresholds, correlationNote);
    }
    reasons.push("Recovery deployment is healthy relative to the original baseline");
    return buildResult("healthy", reasons, input, latencyDeltaPct, thresholds, correlationNote);
  }

  if (latencyRegressed) {
    reasons.push("Observed p95 exceeded both 1.5x and baseline + 250ms");
  }
  if (errorRegressed) {
    reasons.push("Observed error rate exceeded baseline by 2pp and reached at least 5%");
  }
  if (latencyRegressed || errorRegressed) {
    return buildResult("regressed", reasons, input, latencyDeltaPct, thresholds, correlationNote);
  }

  reasons.push("Observed latency and error rate remained within configured thresholds");
  return buildResult("healthy", reasons, input, latencyDeltaPct, thresholds, correlationNote);
}

function buildResult(
  status: RegressionStatus,
  reasons: string[],
  input: EvaluationInput,
  latencyDeltaPct: number | null,
  thresholds: RegressionThresholds,
  correlationNote: string,
): EvaluationResult {
  return {
    status,
    reasons,
    baselineRequestCount: input.baseline.requestCount,
    observedRequestCount: input.observed.requestCount,
    baselineP95Ms: input.baseline.p95Ms,
    observedP95Ms: input.observed.p95Ms,
    baselineP90Ms: input.baseline.p90Ms,
    observedP90Ms: input.observed.p90Ms,
    baselineErrorRate: input.baseline.errorRate,
    observedErrorRate: input.observed.errorRate,
    latencyDeltaPct,
    correlationNote,
    thresholds,
  };
}
