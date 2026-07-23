import { describe, expect, it } from "vitest";
import { evaluateRegression } from "../src/modules/regressions/evaluator.js";

describe("regression evaluator", () => {
  it("returns insufficient_data below the 200-span floor", () => {
    const result = evaluateRegression({
      comparisonKind: "deployment",
      baseline: { requestCount: 199, p90Ms: 100, p95Ms: 120, errorRate: 1 },
      observed: { requestCount: 250, p90Ms: 400, p95Ms: 500, errorRate: 8 },
    });
    expect(result.status).toBe("insufficient_data");
  });

  it("requires both latency conditions for regressed status", () => {
    const result = evaluateRegression({
      comparisonKind: "deployment",
      baseline: { requestCount: 250, p90Ms: 100, p95Ms: 100, errorRate: 1 },
      observed: { requestCount: 250, p90Ms: 160, p95Ms: 160, errorRate: 1 },
    });
    expect(result.status).toBe("healthy");

    const regressed = evaluateRegression({
      comparisonKind: "deployment",
      baseline: { requestCount: 250, p90Ms: 200, p95Ms: 200, errorRate: 1 },
      observed: { requestCount: 250, p90Ms: 500, p95Ms: 500, errorRate: 1 },
    });
    expect(regressed.status).toBe("regressed");
  });

  it("applies the exact error regression rule", () => {
    const result = evaluateRegression({
      comparisonKind: "deployment",
      baseline: { requestCount: 250, p90Ms: 100, p95Ms: 100, errorRate: 1 },
      observed: { requestCount: 250, p90Ms: 110, p95Ms: 110, errorRate: 6 },
    });
    expect(result.status).toBe("regressed");
  });

  it("never converts integration failures into zero metrics", () => {
    const result = evaluateRegression({
      comparisonKind: "deployment",
      baseline: { requestCount: null, p90Ms: null, p95Ms: null, errorRate: null, integrationError: "timeout" },
      observed: { requestCount: 250, p90Ms: 500, p95Ms: 500, errorRate: 8 },
    });
    expect(result.status).toBe("insufficient_data");
    expect(result.baselineP95Ms).toBeNull();
  });
});
