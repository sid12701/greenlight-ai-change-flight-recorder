import { afterEach, describe, expect, it } from "vitest";
import { Repositories } from "../src/db/repositories/index.js";
import { temporaryDatabase } from "./support/config.js";

const NOW = "2026-07-24T10:00:00.000Z";

describe("repository durability", () => {
  let cleanup = () => {};
  afterEach(() => cleanup());

  async function setup() {
    const database = temporaryDatabase();
    cleanup = database.cleanup;
    const repos = Repositories.create(database.path);
    await repos.upsertRepository({
      id: "repo_1",
      provider: "github",
      owner: "demo",
      name: "lms",
      default_branch: "main",
    });
    return repos;
  }

  async function seedChange(repos: Repositories, id: string, sha: string) {
    await repos.upsertChange({
      id,
      repository_id: "repo_1",
      commit_sha: sha,
      short_sha: sha.slice(0, 7),
      branch: "main",
      commit_subject: id,
      committed_at: NOW,
      ai_traceparent: null,
      ai_trace_id: null,
      ai_span_id: null,
      ai_trace_flags: null,
      ai_link_status: "missing",
      changed_files_count: 0,
      additions: 0,
      deletions: 0,
      changed_paths_json: null,
      created_at: NOW,
    });
  }

  async function seedDeployment(repos: Repositories, id: string, changeId: string, role: "baseline" | "candidate") {
    await repos.insertDeployment({
      id,
      change_id: changeId,
      service_name: "lms-backend",
      environment_name: "hackathon-demo",
      role,
      status: "succeeded",
      deployed_at: NOW,
      emitted_trace_id: null,
      provider: "test",
      idempotency_key: id,
      readiness_at: NOW,
      version_state: "verified",
      trace_state: "verified",
      created_at: NOW,
    });
  }

  it("applies defaults for optional fields that are present but undefined", async () => {
    const repos = await setup();
    // A caller assembling a row from partially-populated data must not hit an
    // opaque binder failure; the writer supplies the documented default.
    await expect(repos.upsertChange({
      id: "chg_undef",
      repository_id: "repo_1",
      commit_sha: "a".repeat(40),
      short_sha: "aaaaaaa",
      branch: null,
      commit_subject: "x",
      committed_at: NOW,
      ai_traceparent: null,
      ai_trace_id: null,
      ai_span_id: null,
      ai_trace_flags: null,
      ai_link_status: "linked",
      ai_verification_state: undefined,
      ai_verified_at: undefined,
      ai_verification_error: undefined,
      changed_files_count: null,
      additions: null,
      deletions: null,
      changed_paths_json: null,
      created_at: NOW,
    })).resolves.not.toThrow();
    expect((await repos.getChangeBySha("a".repeat(40)))?.ai_verification_state).toBe("unverified");
    await repos.close();
  });

  it("supports nested transactions without discarding the outer unit of work", async () => {
    const repos = await setup();

    await repos.transaction(async (tx) => {
      await tx.enqueueJob({ id: "job_outer", kind: "github_sync_latest", payload_json: "{}" });
      await tx.transaction(async (inner) => {
        await inner.enqueueJob({ id: "job_inner", kind: "github_sync_runs", payload_json: "{}" });
      });
    });

    expect(await repos.getJob("job_outer")).toBeDefined();
    expect(await repos.getJob("job_inner")).toBeDefined();
    await repos.close();
  });

  it("rolls back only the inner scope when a nested unit of work fails", async () => {
    const repos = await setup();

    await repos.transaction(async (tx) => {
      await tx.enqueueJob({ id: "job_kept", kind: "github_sync_latest", payload_json: "{}" });
      try {
        await repos.transaction(async (tx) => {
          await tx.enqueueJob({ id: "job_discarded", kind: "github_sync_runs", payload_json: "{}" });
          throw new Error("inner failure");
        });
      } catch {
        // The caller absorbs the inner failure and keeps its own work.
      }
    });

    expect(await repos.getJob("job_kept")).toBeDefined();
    expect(await repos.getJob("job_discarded")).toBeUndefined();
    await repos.close();
  });

  it("discards every write when the outermost transaction fails", async () => {
    const repos = await setup();

    await expect(repos.transaction(async (tx) => {
      await tx.enqueueJob({ id: "job_rolled_back", kind: "github_sync_latest", payload_json: "{}" });
      throw new Error("outer failure");
    })).rejects.toThrow("outer failure");

    expect(await repos.getJob("job_rolled_back")).toBeUndefined();
    await repos.close();
  });

  it("re-running an evaluation refreshes it instead of failing", async () => {
    const repos = await setup();
    seedChange(repos, "chg_base", "b".repeat(40));
    seedChange(repos, "chg_cand", "c".repeat(40));
    seedDeployment(repos, "dep_base", "chg_base", "baseline");
    seedDeployment(repos, "dep_cand", "chg_cand", "candidate");

    const row = {
      id: "eval_1",
      deployment_id: "dep_cand",
      baseline_deployment_id: "dep_base",
      route: "/api/v1/internal/home/overview",
      comparison_kind: "deployment" as const,
      baseline_service_version: "b".repeat(40),
      observed_service_version: "c".repeat(40),
      baseline_start: NOW,
      baseline_end: NOW,
      observed_start: NOW,
      observed_end: NOW,
      baseline_request_count: 250,
      observed_request_count: 250,
      baseline_p95_ms: 100,
      observed_p95_ms: 100,
      latency_delta_pct: 0,
      baseline_error_rate: 1,
      observed_error_rate: 1,
      status: "healthy" as const,
      reasons_json: "[]",
      signoz_dashboard_url: null,
      evaluated_at: NOW,
    };

    await repos.insertRegressionEvaluation(row);
    // A worker restart between commit and acknowledgement replays the job;
    // the replay must converge rather than poison the queue.
    await expect(repos.insertRegressionEvaluation({
      ...row,
      status: "regressed",
      observed_p95_ms: 900,
    })).resolves.not.toThrow();

    const stored = await repos.getLatestEvaluationForDeployment("dep_cand");
    expect(stored?.status).toBe("regressed");
    expect(stored?.observed_p95_ms).toBe(900);
    await repos.close();
  });

  it("replaces evidence so a superseded attempt leaves nothing behind", async () => {
    const repos = await setup();
    seedChange(repos, "chg_base", "b".repeat(40));
    seedChange(repos, "chg_cand", "c".repeat(40));
    seedDeployment(repos, "dep_base", "chg_base", "baseline");
    seedDeployment(repos, "dep_cand", "chg_cand", "candidate");
    await repos.insertRegressionEvaluation({
      id: "eval_1",
      deployment_id: "dep_cand",
      baseline_deployment_id: "dep_base",
      route: "/r",
      comparison_kind: "deployment",
      baseline_service_version: "b".repeat(40),
      observed_service_version: "c".repeat(40),
      baseline_start: NOW,
      baseline_end: NOW,
      observed_start: NOW,
      observed_end: NOW,
      baseline_request_count: 250,
      observed_request_count: 250,
      baseline_p95_ms: 100,
      observed_p95_ms: 100,
      latency_delta_pct: 0,
      baseline_error_rate: 1,
      observed_error_rate: 1,
      status: "healthy",
      reasons_json: "[]",
      signoz_dashboard_url: null,
      evaluated_at: NOW,
    });

    await repos.replaceEvidenceLinks("eval_1", [
      {
        id: "eval_1_trace_1",
        regression_evaluation_id: "eval_1",
        kind: "signoz_trace",
        label: "Slow trace 1",
        url: "http://signoz.test/trace/aaaa",
        created_at: NOW,
      },
      {
        id: "eval_1_trace_2",
        regression_evaluation_id: "eval_1",
        kind: "signoz_trace",
        label: "Slow trace 2",
        url: "http://signoz.test/trace/bbbb",
        created_at: NOW,
      },
    ]);
    await repos.replaceEvidenceLinks("eval_1", [
      {
        id: "eval_1_trace_1",
        regression_evaluation_id: "eval_1",
        kind: "signoz_trace",
        label: "Slow trace 1",
        url: "http://signoz.test/trace/cccc",
        verification_state: "verified",
        verified_at: NOW,
        created_at: NOW,
      },
    ]);

    const links = await repos.getEvidenceLinksForEvaluation("eval_1");
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe("http://signoz.test/trace/cccc");
    expect(links[0].verification_state).toBe("verified");
    await repos.close();
  });

  it("scopes baseline lookup to one service and environment", async () => {
    const repos = await setup();
    seedChange(repos, "chg_a", "a".repeat(40));
    seedDeployment(repos, "dep_a", "chg_a", "baseline");
    await repos.insertDeployment({
      id: "dep_other_env",
      change_id: "chg_a",
      service_name: "lms-backend",
      environment_name: "staging",
      role: "baseline",
      status: "succeeded",
      deployed_at: NOW,
      emitted_trace_id: null,
      provider: "test",
      idempotency_key: "dep_other_env",
      readiness_at: NOW,
      version_state: "verified",
      created_at: NOW,
    });

    const scoped = await repos.listBaselineDeployments("lms-backend", "hackathon-demo");
    expect(scoped.map((row) => row.id)).toEqual(["dep_a"]);
    await repos.close();
  });

  it("reports a zero count for job states that hold no rows", async () => {
    const repos = await setup();

    // A drained state must still report. A gauge that stops emitting is
    // indistinguishable from a collector that stopped, which is exactly the
    // ambiguity queue depth exists to remove.
    expect(await repos.countJobsByState()).toEqual({
      pending: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
    });

    await repos.enqueueJob({ id: "job_a", kind: "github_sync_runs", payload_json: "{}" });
    await repos.enqueueJob({ id: "job_b", kind: "deployment_record", payload_json: "{}" });

    expect(await repos.countJobsByState()).toEqual({
      pending: 2,
      running: 0,
      succeeded: 0,
      failed: 0,
    });
    await repos.close();
  });
});
