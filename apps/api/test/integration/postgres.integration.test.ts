/**
 * Runs the repository contract against a real PostgreSQL server.
 *
 * The same assertions run against SQLite in the default suite. Running both
 * is the point: a statement that works on one engine and not the other is
 * exactly the defect this file exists to catch, and no amount of mocking
 * would reveal it.
 *
 * Skipped unless GREENLIGHT_TEST_DATABASE_URL is set.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { PostgresDriver } from "../../src/db/postgres-driver.js";
import { Repositories } from "../../src/db/repositories/index.js";

const ADMIN_URL = process.env.GREENLIGHT_TEST_DATABASE_URL;
const describePostgres = ADMIN_URL ? describe : describe.skip;

const NOW = "2026-07-24T10:00:00.000Z";
let databaseName = "";
let repos: Repositories;

describePostgres("repository contract on postgresql", () => {
  beforeAll(async () => {
    // Each run gets its own database so a failure cannot leak into the next.
    databaseName = `greenlight_test_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: ADMIN_URL });
    await admin.query(`CREATE DATABASE ${databaseName}`);
    await admin.end();

    const url = new URL(ADMIN_URL as string);
    url.pathname = `/${databaseName}`;
    repos = new Repositories(await PostgresDriver.connect(url.toString()));
  }, 60_000);

  afterAll(async () => {
    await repos?.close();
    if (databaseName) {
      const admin = new Pool({ connectionString: ADMIN_URL });
      await admin.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
      await admin.end();
    }
  }, 60_000);

  async function seedChange(id: string, sha: string) {
    await repos.upsertRepository({
      id: "repo_1", provider: "github", owner: "demo", name: "workload", default_branch: "main",
    });
    await repos.upsertChange({
      id, repository_id: "repo_1", commit_sha: sha, short_sha: sha.slice(0, 7),
      branch: "main", commit_subject: id, committed_at: NOW,
      ai_traceparent: null, ai_trace_id: null, ai_span_id: null, ai_trace_flags: null,
      ai_link_status: "missing", changed_files_count: 0, additions: 0, deletions: 0,
      changed_paths_json: null, created_at: NOW,
    });
  }

  it("applies every migration", async () => {
    expect(await repos.ping()).toBe(true);
    expect(await repos.listChanges()).toEqual([]);
  });

  it("upserts a change idempotently", async () => {
    await seedChange("chg_1", "a".repeat(40));
    await seedChange("chg_1", "a".repeat(40));
    const changes = await repos.listChanges();
    expect(changes).toHaveLength(1);
    // The default is applied by the writer, not by the caller.
    expect(changes[0].ai_verification_state).toBe("missing");
  });

  it("enforces one succeeded baseline per service and environment", async () => {
    await seedChange("chg_base", "b".repeat(40));
    const baseline = (suffix: string) => ({
      id: `dep_base_${suffix}`, change_id: "chg_base", service_name: "blnk-loan-workload",
      environment_name: "hackathon-demo", role: "baseline" as const,
      status: "succeeded" as const, deployed_at: NOW, emitted_trace_id: null,
      provider: "test", idempotency_key: `key_${suffix}`, readiness_at: NOW,
      version_state: "verified" as const, created_at: NOW,
    });
    await repos.insertDeployment(baseline("one"));
    await expect(repos.insertDeployment(baseline("two"))).rejects.toThrow();
  });

  it("rolls back every write when a transaction fails", async () => {
    await expect(repos.transaction(async (tx) => {
      await tx.enqueueJob({ id: "job_rollback", kind: "github_sync_latest", payload_json: "{}" });
      throw new Error("boom");
    })).rejects.toThrow("boom");
    expect(await repos.getJob("job_rollback")).toBeUndefined();
  });

  it("rolls back only the inner scope of a nested transaction", async () => {
    await repos.transaction(async (tx) => {
      await tx.enqueueJob({ id: "job_outer", kind: "github_sync_latest", payload_json: "{}" });
      await tx.transaction(async (inner) => {
        await inner.enqueueJob({ id: "job_inner", kind: "github_sync_runs", payload_json: "{}" });
        throw new Error("inner");
      }).catch(() => {});
    });
    expect(await repos.getJob("job_outer")).toBeDefined();
    expect(await repos.getJob("job_inner")).toBeUndefined();
  });

  it("claims a job exactly once when workers race", async () => {
    await repos.enqueueJob({ id: "job_race", kind: "regression_evaluate", payload_json: "{}" });
    const now = new Date().toISOString();
    // Two workers polling simultaneously must not both take the same job.
    const claims = await Promise.all([
      repos.claimNextJob(now),
      repos.claimNextJob(now),
      repos.claimNextJob(now),
    ]);
    expect(claims.filter((job) => job?.id === "job_race")).toHaveLength(1);
  });

  it("re-running an evaluation refreshes it rather than failing", async () => {
    await seedChange("chg_cand", "c".repeat(40));
    for (const [id, role] of [["dep_b", "baseline"], ["dep_c", "candidate"]] as const) {
      await repos.insertDeployment({
        id, change_id: "chg_cand", service_name: "svc", environment_name: "env",
        role, status: "succeeded", deployed_at: NOW, emitted_trace_id: null,
        provider: "test", idempotency_key: id, readiness_at: NOW,
        version_state: "verified", created_at: NOW,
      });
    }
    const row = {
      id: "eval_pg", deployment_id: "dep_c", baseline_deployment_id: "dep_b",
      route: "/r", comparison_kind: "deployment" as const,
      baseline_service_version: "b".repeat(40), observed_service_version: "c".repeat(40),
      baseline_start: NOW, baseline_end: NOW, observed_start: NOW, observed_end: NOW,
      baseline_request_count: 250, observed_request_count: 250,
      baseline_p95_ms: 100, observed_p95_ms: 100, latency_delta_pct: 0,
      baseline_error_rate: 1, observed_error_rate: 1,
      status: "healthy" as const, reasons_json: "[]",
      signoz_dashboard_url: null, evaluated_at: NOW,
    };
    await repos.insertRegressionEvaluation(row);
    await repos.insertRegressionEvaluation({ ...row, status: "regressed", observed_p95_ms: 900 });
    const stored = await repos.getLatestEvaluationForDeployment("dep_c");
    expect(stored?.status).toBe("regressed");
    expect(stored?.observed_p95_ms).toBe(900);
  });

  it("replaces evidence so a superseded attempt leaves nothing behind", async () => {
    await repos.replaceEvidenceLinks("eval_pg", [
      { id: "e1", regression_evaluation_id: "eval_pg", kind: "signoz_trace",
        label: "Slow trace 1", url: "http://signoz.test/trace/a", created_at: NOW },
      { id: "e2", regression_evaluation_id: "eval_pg", kind: "signoz_trace",
        label: "Slow trace 2", url: "http://signoz.test/trace/b", created_at: NOW },
    ]);
    await repos.replaceEvidenceLinks("eval_pg", [
      { id: "e1", regression_evaluation_id: "eval_pg", kind: "signoz_trace",
        label: "Slow trace 1", url: "http://signoz.test/trace/c",
        verification_state: "verified", verified_at: NOW, created_at: NOW },
    ]);
    const links = await repos.getEvidenceLinksForEvaluation("eval_pg");
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe("http://signoz.test/trace/c");
    expect(links[0].verification_state).toBe("verified");
  });

  it("reads a CI duration back as a number, not a string", async () => {
    await seedChange("chg_duration", "d".repeat(40));
    await repos.upsertPipelineRun({
      id: "run_duration", change_id: "chg_duration", provider_run_id: "9001",
      workflow_name: "CI", status: "completed", conclusion: "success",
      started_at: NOW, completed_at: NOW, duration_ms: 123_000,
      slowest_step: "Build", html_url: "http://ci.test/9001", is_primary: 1,
      emitted_trace_id: null, synced_at: NOW,
    } as never);

    const [run] = await repos.getPipelineRunsForChange("chg_duration");
    // node-postgres returns int8 as a string to protect precision above 2^53.
    // The receipt contract declares `number | null`, so a bigint column here
    // made the web client reject the whole receipt — while SQLite, which
    // returns a number, passed. The column is INTEGER on both engines now.
    expect(typeof run.duration_ms).toBe("number");
    expect(run.duration_ms).toBe(123_000);
  });
});
