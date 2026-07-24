/**
 * Pure regression verdict logic.
 *
 * The evaluator only ever sees metrics that SigNoz actually answered with.
 * Integration failures are handled by `RegressionService` before this point,
 * so a missing metric here always means "SigNoz reported no data", never
 * "SigNoz could not be reached".
 */
import type { RegressionStatus } from "@greenlight/shared";

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

export const CORRELATION_NOTE =
  "Deployment correlation is evidence of temporal and version association, not proof that every observed failure was caused by the commit.";

/** The metric set an evaluation compares. Every field is required to be present. */
export interface ComparableMetrics {
  requestCount: number | null;
  p90Ms: number | null;
  p95Ms: number | null;
  errorRatePercent: number | null;
}

export interface EvaluationInput {
  baseline: ComparableMetrics;
  observed: ComparableMetrics;
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

function isComplete(metrics: ComparableMetrics): boolean {
  return [metrics.requestCount, metrics.p90Ms, metrics.p95Ms, metrics.errorRatePercent]
    .every((value) => value !== null && Number.isFinite(value));
}

function result(
  status: RegressionStatus,
  reasons: string[],
  input: EvaluationInput,
  thresholds: RegressionThresholds,
  latencyDeltaPct: number | null,
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
    baselineErrorRate: input.baseline.errorRatePercent,
    observedErrorRate: input.observed.errorRatePercent,
    latencyDeltaPct,
    correlationNote: CORRELATION_NOTE,
    thresholds,
  };
}

export function evaluateRegression(input: EvaluationInput): EvaluationResult {
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;

  if (!isComplete(input.baseline) || !isComplete(input.observed)) {
    return result(
      "insufficient_data",
      ["One or more required SigNoz metrics were absent for the evaluated window"],
      input,
      thresholds,
      null,
    );
  }

  const baselineCount = input.baseline.requestCount as number;
  const observedCount = input.observed.requestCount as number;
  if (baselineCount < thresholds.minSpans || observedCount < thresholds.minSpans) {
    return result(
      "insufficient_data",
      [`Fewer than ${thresholds.minSpans} completed spans in one or both windows`],
      input,
      thresholds,
      null,
    );
  }

  const baselineP95 = input.baseline.p95Ms as number;
  const observedP95 = input.observed.p95Ms as number;
  const baselineError = input.baseline.errorRatePercent as number;
  const observedError = input.observed.errorRatePercent as number;
  const latencyDeltaPct = baselineP95 === 0
    ? null
    : ((observedP95 - baselineP95) / baselineP95) * 100;

  const latencyRegressed =
    observedP95 > baselineP95 * thresholds.latencyMultiplier &&
    observedP95 > baselineP95 + thresholds.latencyAdditiveMs;
  const errorRegressed =
    observedError >= baselineError + thresholds.errorRateDeltaPct &&
    observedError >= thresholds.errorRateAbsolutePct;

  if (input.comparisonKind === "recovery") {
    const latencyRecovered = observedP95 <= baselineP95 * thresholds.recoveryLatencyMultiplier;
    const errorRecovered = observedError <= baselineError + thresholds.recoveryErrorRateDeltaPct;
    if (latencyRecovered && errorRecovered) {
      return result(
        "recovered",
        ["Observed latency and error rate returned within recovery bounds versus the original good baseline"],
        input,
        thresholds,
        latencyDeltaPct,
      );
    }
    if (latencyRegressed || errorRegressed) {
      return result(
        "regressed",
        ["Recovery deployment still exceeds regression thresholds"],
        input,
        thresholds,
        latencyDeltaPct,
      );
    }
    return result(
      "healthy",
      ["Recovery deployment is healthy relative to the original baseline but outside recovery bounds"],
      input,
      thresholds,
      latencyDeltaPct,
    );
  }

  const reasons: string[] = [];
  if (latencyRegressed) {
    reasons.push(
      `Observed p95 exceeded both ${thresholds.latencyMultiplier}x and baseline + ${thresholds.latencyAdditiveMs}ms`,
    );
  }
  if (errorRegressed) {
    reasons.push(
      `Observed error rate exceeded baseline by ${thresholds.errorRateDeltaPct}pp and reached at least ${thresholds.errorRateAbsolutePct}%`,
    );
  }
  if (reasons.length > 0) {
    return result("regressed", reasons, input, thresholds, latencyDeltaPct);
  }

  return result(
    "healthy",
    ["Observed latency and error rate remained within configured thresholds"],
    input,
    thresholds,
    latencyDeltaPct,
  );
}
