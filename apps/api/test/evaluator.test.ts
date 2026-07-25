import { describe, expect, it } from "vitest";
import {
  CURRENT_POLICY_VERSION,
  DEFAULT_THRESHOLDS,
  REGRESSION_POLICIES,
  evaluateRegression,
  thresholdsForPolicyVersion,
  type ComparableMetrics,
} from "../src/modules/regressions/evaluator.js";

function metrics(overrides: Partial<ComparableMetrics> = {}): ComparableMetrics {
  return {
    requestCount: 250,
    p90Ms: 100,
    p95Ms: 100,
    errorRatePercent: 1,
    ...overrides,
  };
}

describe("regression evaluator", () => {
  it("returns insufficient_data below the configured span floor", () => {
    const result = evaluateRegression({
      comparisonKind: "deployment",
      baseline: metrics({ requestCount: DEFAULT_THRESHOLDS.minSpans - 1 }),
      observed: metrics({ p95Ms: 500, errorRatePercent: 8 }),
    });
    expect(result.status).toBe("insufficient_data");
    expect(result.reasons[0]).toContain(String(DEFAULT_THRESHOLDS.minSpans));
  });

  it("honours a non-default span floor from the supplied policy", () => {
    const thresholds = { ...DEFAULT_THRESHOLDS, minSpans: 50 };
    const result = evaluateRegression({
      comparisonKind: "deployment",
      baseline: metrics({ requestCount: 60 }),
      observed: metrics({ requestCount: 60 }),
      thresholds,
    });
    expect(result.status).toBe("healthy");
    expect(result.thresholds.minSpans).toBe(50);
  });

  it("requires both latency conditions before declaring a regression", () => {
    // 1.4x baseline and well past the additive floor: the multiplier is not met.
    expect(evaluateRegression({
      comparisonKind: "deployment",
      baseline: metrics({ p95Ms: 100 }),
      observed: metrics({ p95Ms: 140 }),
    }).status).toBe("healthy");

    // 2x baseline but only +1ms: the additive floor is not met, so a rise
    // within timing jitter cannot be reported however large its ratio.
    expect(evaluateRegression({
      comparisonKind: "deployment",
      baseline: metrics({ p95Ms: 1 }),
      observed: metrics({ p95Ms: 2 }),
    }).status).toBe("healthy");

    // Both guards met.
    expect(evaluateRegression({
      comparisonKind: "deployment",
      baseline: metrics({ p95Ms: 200 }),
      observed: metrics({ p95Ms: 500 }),
    }).status).toBe("regressed");
  });

  it("reports a millisecond-scale latency regression that v1 could not", () => {
    // The recorded demo measurement: p95 1.44ms rising to 10.45ms is a 7.3x
    // regression on a fast endpoint. v1's 250ms perception floor made it
    // unreportable; v2's resolution floor reports it.
    const observed = {
      comparisonKind: "deployment" as const,
      baseline: metrics({ p95Ms: 1.44 }),
      observed: metrics({ p95Ms: 10.45 }),
    };

    const underV2 = evaluateRegression({ ...observed, thresholds: REGRESSION_POLICIES.v2 });
    expect(underV2.status).toBe("regressed");
    expect(underV2.reasons.join(" ")).toContain("p95");

    const underV1 = evaluateRegression({ ...observed, thresholds: REGRESSION_POLICIES.v1 });
    expect(underV1.status).toBe("healthy");
  });

  it("resolves a stored policy version to the rules that decided it", () => {
    expect(thresholdsForPolicyVersion("v1")).toEqual(REGRESSION_POLICIES.v1);
    expect(thresholdsForPolicyVersion("v2")).toEqual(REGRESSION_POLICIES.v2);
    // A row written before policies were versioned predates every later
    // policy, so it must resolve to the oldest rather than to the newest.
    expect(thresholdsForPolicyVersion(null)).toEqual(REGRESSION_POLICIES.v1);
    expect(thresholdsForPolicyVersion("v99")).toEqual(REGRESSION_POLICIES.v1);
  });

  it("requires both error conditions before declaring a regression", () => {
    // +5pp but below the 5% absolute floor is not a regression.
    expect(evaluateRegression({
      comparisonKind: "deployment",
      baseline: metrics({ errorRatePercent: 0 }),
      observed: metrics({ errorRatePercent: 4 }),
    }).status).toBe("healthy");

    expect(evaluateRegression({
      comparisonKind: "deployment",
      baseline: metrics({ errorRatePercent: 1 }),
      observed: metrics({ errorRatePercent: 6 }),
    }).status).toBe("regressed");
  });

  it("never invents metrics when SigNoz reported no data", () => {
    const result = evaluateRegression({
      comparisonKind: "deployment",
      baseline: metrics({ requestCount: null, p90Ms: null, p95Ms: null, errorRatePercent: null }),
      observed: metrics({ p95Ms: 500, errorRatePercent: 8 }),
    });
    expect(result.status).toBe("insufficient_data");
    expect(result.baselineP95Ms).toBeNull();
    expect(result.baselineRequestCount).toBeNull();
    expect(result.latencyDeltaPct).toBeNull();
  });

  it("declares recovery only against the original baseline bounds", () => {
    const baseline = metrics({ p95Ms: 100, errorRatePercent: 1 });

    expect(evaluateRegression({
      comparisonKind: "recovery",
      baseline,
      observed: metrics({ p95Ms: 110, errorRatePercent: 1.5 }),
    }).status).toBe("recovered");

    // Improved, but still outside recovery bounds and not yet regressed.
    expect(evaluateRegression({
      comparisonKind: "recovery",
      baseline,
      observed: metrics({ p95Ms: 140, errorRatePercent: 1 }),
    }).status).toBe("healthy");

    expect(evaluateRegression({
      comparisonKind: "recovery",
      baseline,
      observed: metrics({ p95Ms: 900, errorRatePercent: 1 }),
    }).status).toBe("regressed");
  });

  it("recovers when the residual rise is beneath the policy's own noise floor", () => {
    // The recorded recovery: 1.44ms baseline, 2.08ms observed. That 0.64ms rise
    // is 1.44x the baseline, so a purely multiplicative bound rejects it — while
    // the same policy considers a 0.64ms rise far too small to be a regression.
    // A rise cannot be both beneath notice and disqualifying.
    const result = evaluateRegression({
      comparisonKind: "recovery",
      baseline: metrics({ p95Ms: 1.44, errorRatePercent: 0 }),
      observed: metrics({ p95Ms: 2.08, errorRatePercent: 0 }),
    });
    expect(result.status).toBe("recovered");

    // The floor is a floor, not a blanket exemption: a rise past it still has
    // to satisfy the multiplier.
    expect(evaluateRegression({
      comparisonKind: "recovery",
      baseline: metrics({ p95Ms: 1.44, errorRatePercent: 0 }),
      observed: metrics({ p95Ms: 10.45, errorRatePercent: 0 }),
    }).status).not.toBe("recovered");
  });

  it("reports latency delta relative to the baseline", () => {
    const result = evaluateRegression({
      comparisonKind: "deployment",
      baseline: metrics({ p95Ms: 200 }),
      observed: metrics({ p95Ms: 500 }),
    });
    expect(result.latencyDeltaPct).toBeCloseTo(150);
  });

  it("carries the applied policy on every verdict", () => {
    const result = evaluateRegression({
      comparisonKind: "deployment",
      baseline: metrics(),
      observed: metrics(),
    });
    expect(result.thresholds).toEqual(DEFAULT_THRESHOLDS);
    expect(result.correlationNote).toContain("not proof");
  });

  it("decides new verdicts with the current policy", () => {
    expect(DEFAULT_THRESHOLDS).toEqual(REGRESSION_POLICIES[CURRENT_POLICY_VERSION]);
  });
});
