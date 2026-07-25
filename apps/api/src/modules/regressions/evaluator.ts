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
  /**
   * Minimum absolute p95 rise, in milliseconds, before a latency regression may
   * be reported.
   *
   * This is a *measurement-significance* floor, not a user-perception one. Its
   * job is to stop timer resolution and scheduling jitter from being reported
   * as a regression; deciding whether a real rise matters to a user is the
   * reader's call, not the evaluator's. Setting it to a perceptible duration
   * makes the guard scale-dependent: it silently exempts every endpoint whose
   * baseline is far below it, which is exactly where a large multiplicative
   * regression is easiest to cause and hardest to notice.
   */
  latencyAdditiveMs: number;
  errorRateDeltaPct: number;
  errorRateAbsolutePct: number;
  minSpans: number;
  recoveryLatencyMultiplier: number;
  recoveryErrorRateDeltaPct: number;
}

/**
 * Every policy that has ever decided a verdict, kept by version.
 *
 * Policies are immutable and additive. A stored evaluation records the version
 * that decided it, so an old receipt can still be explained with the rules it
 * was actually measured against rather than with today's.
 */
export const REGRESSION_POLICIES = {
  /**
   * The original policy. Its 250 ms floor was chosen as a duration a user would
   * notice, which made it unreachable for any endpoint faster than that: a
   * 1.4 ms route would have to reach 251 ms — a 174x regression — before
   * latency could be reported at all.
   */
  v1: {
    latencyMultiplier: 1.5,
    latencyAdditiveMs: 250,
    errorRateDeltaPct: 2,
    errorRateAbsolutePct: 5,
    minSpans: 200,
    recoveryLatencyMultiplier: 1.2,
    recoveryErrorRateDeltaPct: 1,
  },
  /**
   * Replaces the perception floor with a resolution floor. 2 ms is comfortably
   * above OpenTelemetry span timing granularity and ordinary scheduling jitter,
   * so a rise that clears both it and the 1.5x multiplier is a real measured
   * change at any service scale. The multiplier still suppresses small absolute
   * rises on slow endpoints, which is what the original floor was reaching for.
   */
  v2: {
    latencyMultiplier: 1.5,
    latencyAdditiveMs: 2,
    errorRateDeltaPct: 2,
    errorRateAbsolutePct: 5,
    minSpans: 200,
    recoveryLatencyMultiplier: 1.2,
    recoveryErrorRateDeltaPct: 1,
  },
} as const satisfies Record<string, RegressionThresholds>;

export type PolicyVersion = keyof typeof REGRESSION_POLICIES;

export const CURRENT_POLICY_VERSION: PolicyVersion = "v2";

/** The policy new evaluations are decided with. */
export const DEFAULT_THRESHOLDS: RegressionThresholds =
  REGRESSION_POLICIES[CURRENT_POLICY_VERSION];

/**
 * Resolves a stored `policy_version` to its threshold set.
 *
 * An unrecognised version resolves to `v1` rather than to the current policy:
 * a row written before a policy existed predates it, and describing an old
 * verdict with newer rules would misstate how it was decided.
 */
export function thresholdsForPolicyVersion(version: string | null | undefined): RegressionThresholds {
  return REGRESSION_POLICIES[version as PolicyVersion] ?? REGRESSION_POLICIES.v1;
}

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
    // Recovery uses the same resolution floor as the regression rule, for
    // consistency rather than for leniency. A purely multiplicative bound is
    // tighter than measurement noise at millisecond scale: against a 1.44ms
    // baseline it demands 1.73ms, so an observed 2.08ms — a rise of 0.64ms —
    // would be reported as "not recovered" while the identical rise is, by the
    // same policy, too small to be called a regression. A rise cannot be
    // simultaneously beneath notice and disqualifying.
    const latencyRecovered =
      observedP95 <= baselineP95 * thresholds.recoveryLatencyMultiplier ||
      observedP95 - baselineP95 <= thresholds.latencyAdditiveMs;
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
