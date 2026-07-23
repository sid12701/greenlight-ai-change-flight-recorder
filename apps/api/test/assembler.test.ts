import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assembleReceipt } from "../src/modules/receipts/assembler.js";

describe("receipt assembler", () => {
  it("assembles linked, regressed, and recovered states without duplicate evidence URLs", () => {
    const receipt = assembleReceipt({
      repository: "demo/lms",
      signozUrl: "http://localhost:8080",
      change: {
        id: "chg_1",
        repository_id: "repo_1",
        commit_sha: "a".repeat(40),
        short_sha: "aaaaaaa",
        branch: "greenlight-demo",
        commit_subject: "docs: proof",
        committed_at: "2026-07-23T10:00:00.000Z",
        ai_traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        ai_trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
        ai_span_id: "00f067aa0ba902b7",
        ai_trace_flags: "01",
        ai_link_status: "linked",
        changed_files_count: 1,
        additions: 1,
        deletions: 0,
        changed_paths_json: null,
        created_at: "2026-07-23T10:00:00.000Z",
      },
      pipelines: [
        {
          id: "run_1",
          change_id: "chg_1",
          provider_run_id: "100",
          workflow_name: "Backend CI",
          status: "completed",
          conclusion: "success",
          started_at: "2026-07-23T10:00:00.000Z",
          completed_at: "2026-07-23T10:05:00.000Z",
          html_url: "https://github.com/demo/lms/actions/runs/100",
          is_primary: 1,
          emitted_trace_id: "feedfacefeedfacefeedfacefeedface",
          synced_at: "2026-07-23T10:06:00.000Z",
        },
        {
          id: "run_2",
          change_id: "chg_1",
          provider_run_id: "200",
          workflow_name: "Frontend CI",
          status: "completed",
          conclusion: "success",
          started_at: "2026-07-23T10:00:00.000Z",
          completed_at: "2026-07-23T10:03:00.000Z",
          html_url: "https://github.com/demo/lms/actions/runs/200",
          is_primary: 0,
          emitted_trace_id: null,
          synced_at: "2026-07-23T10:06:00.000Z",
        },
      ],
      deployments: [
        {
          id: "dep_bad",
          change_id: "chg_1",
          service_name: "lms-backend",
          environment_name: "hackathon-demo",
          role: "candidate",
          status: "succeeded",
          deployed_at: "2026-07-23T11:00:00.000Z",
          emitted_trace_id: null,
          created_at: "2026-07-23T11:00:00.000Z",
        },
      ],
      evaluation: {
        id: "eval_1",
        deployment_id: "dep_bad",
        baseline_deployment_id: "dep_base",
        route: "/api/v1/internal/home/overview",
        comparison_kind: "deployment",
        baseline_service_version: "b".repeat(40),
        observed_service_version: "a".repeat(40),
        baseline_start: "2026-07-23T10:00:00.000Z",
        baseline_end: "2026-07-23T10:01:30.000Z",
        observed_start: "2026-07-23T11:00:00.000Z",
        observed_end: "2026-07-23T11:01:30.000Z",
        baseline_request_count: 250,
        observed_request_count: 250,
        baseline_p95_ms: 120,
        observed_p95_ms: 500,
        latency_delta_pct: 316,
        baseline_error_rate: 1,
        observed_error_rate: 8,
        status: "regressed",
        reasons_json: JSON.stringify(["Observed p95 exceeded thresholds"]),
        signoz_dashboard_url: "http://localhost:8080/dashboard/deployment-impact",
        evaluated_at: "2026-07-23T11:02:00.000Z",
      },
    });

    expect(receipt.pipeline?.htmlUrl).toContain("github.com");
    expect(receipt.relatedPipelines).toHaveLength(1);
    expect(receipt.impact?.status).toBe("regressed");
    expect(receipt.caveat).toContain("not proof");
    expect(receipt.actions.revertCommand).toBe(`git revert ${"a".repeat(40)}`);
  });
});
