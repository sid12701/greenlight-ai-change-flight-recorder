import { describe, expect, it } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  evaluateRegression,
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
    // 1.6x baseline, but only +60ms: the additive guard is not met.
    expect(evaluateRegression({
      comparisonKind: "deployment",
      baseline: metrics({ p95Ms: 100 }),
      observed: metrics({ p95Ms: 160 }),
    }).status).toBe("healthy");

    // +300ms, but only 1.15x: the multiplier guard is not met.
    expect(evaluateRegression({
      comparisonKind: "deployment",
      baseline: metrics({ p95Ms: 2_000 }),
      observed: metrics({ p95Ms: 2_300 }),
    }).status).toBe("healthy");

    // Both guards met.
    expect(evaluateRegression({
      comparisonKind: "deployment",
      baseline: metrics({ p95Ms: 200 }),
      observed: metrics({ p95Ms: 500 }),
    }).status).toBe("regressed");
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
});
