import { describe, expect, it } from "vitest";
import {
  BaselineRequiredError,
  resolveBaselineDeployment,
  resolveRecoveryBaseline,
  validateBaselineOrdering,
} from "../src/modules/regressions/baseline-resolver.js";

const baseline = {
  id: "dep_base",
  change_id: "chg_1",
  service_name: "lms-backend",
  environment_name: "hackathon-demo",
  role: "baseline" as const,
  status: "succeeded" as const,
  deployed_at: "2026-07-23T10:00:00.000Z",
  emitted_trace_id: null,
  created_at: "2026-07-23T10:00:00.000Z",
};

const candidate = {
  ...baseline,
  id: "dep_bad",
  role: "candidate" as const,
  deployed_at: "2026-07-23T12:00:00.000Z",
};

const recovery = {
  ...baseline,
  id: "dep_recovery",
  role: "recovery" as const,
  deployed_at: "2026-07-23T14:00:00.000Z",
};

describe("baseline resolver", () => {
  it("selects the unique frozen baseline deployment", () => {
    expect(resolveBaselineDeployment([baseline, candidate], "lms-backend", "hackathon-demo")).toEqual(baseline);
  });

  it("returns baseline_required when ambiguous", () => {
    expect(() =>
      resolveBaselineDeployment([baseline, { ...baseline, id: "dep_base_2" }], "lms-backend", "hackathon-demo"),
    ).toThrow(BaselineRequiredError);
  });

  it("rejects cross-environment overrides", () => {
    expect(() =>
      validateBaselineOrdering(baseline, {
        ...candidate,
        environment_name: "prod",
      }),
    ).toThrow(BaselineRequiredError);
  });

  it("reuses the original good baseline from the newest regressed evaluation", () => {
    const evaluation = {
      id: "eval_bad",
      deployment_id: candidate.id,
      baseline_deployment_id: baseline.id,
      route: "/api/v1/internal/home/overview",
      comparison_kind: "deployment" as const,
      baseline_service_version: "good",
      observed_service_version: "bad",
      baseline_start: "2026-07-23T10:00:00.000Z",
      baseline_end: "2026-07-23T10:01:30.000Z",
      observed_start: "2026-07-23T12:00:00.000Z",
      observed_end: "2026-07-23T12:01:30.000Z",
      baseline_request_count: 250,
      observed_request_count: 250,
      baseline_p95_ms: 100,
      observed_p95_ms: 500,
      latency_delta_pct: 400,
      baseline_error_rate: 0,
      observed_error_rate: 0,
      status: "regressed" as const,
      reasons_json: "[]",
      signoz_dashboard_url: null,
      evaluated_at: "2026-07-23T12:02:00.000Z",
    };

    const resolved = resolveRecoveryBaseline(
      [evaluation],
      "lms-backend",
      "hackathon-demo",
      "/api/v1/internal/home/overview",
    );
    expect(resolved?.baseline_deployment_id).toBe(baseline.id);
    expect(recovery.role).toBe("recovery");
  });
});
