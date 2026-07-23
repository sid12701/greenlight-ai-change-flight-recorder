import { describe, expect, it } from "vitest";
import {
  BaselineRequiredError,
  resolveBaselineDeployment,
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
});
