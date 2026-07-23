import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrate, openDatabase } from "../src/db/migrate.js";
import { Repositories } from "../src/db/repositories/index.js";

describe("database migrations and repositories", () => {
  let dbPath: string;
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function setup() {
    const dir = mkdtempSync(join(tmpdir(), "greenlight-db-"));
    dbPath = join(dir, "test.db");
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return Repositories.create(dbPath);
  }

  it("applies migrations on a fresh database", () => {
    const repos = setup();
    const db = openDatabase(dbPath);
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining([
        "changes",
        "deployments",
        "evidence_links",
        "pipeline_runs",
        "regression_evaluations",
        "repositories",
        "schema_migrations",
      ]),
    );
    expect(repos.listChanges()).toEqual([]);
  });

  it("is idempotent when migrations run twice", () => {
    setup();
    const db = openDatabase(dbPath);
    migrate(db);
    migrate(db);
    const count = db
      .prepare("SELECT COUNT(*) AS count FROM schema_migrations")
      .get() as { count: number };
    expect(count.count).toBeGreaterThan(0);
  });

  it("enforces one primary pipeline per change", () => {
    const repos = setup();
    repos.upsertRepository({
      id: "repo_1",
      provider: "github",
      owner: "demo",
      name: "lms",
      default_branch: "main",
    });
    repos.upsertChange({
      id: "chg_1",
      repository_id: "repo_1",
      commit_sha: "a".repeat(40),
      short_sha: "aaaaaaa",
      branch: "main",
      commit_subject: "test",
      committed_at: "2026-07-23T00:00:00.000Z",
      ai_traceparent: null,
      ai_trace_id: null,
      ai_span_id: null,
      ai_trace_flags: null,
      ai_link_status: "missing",
      changed_files_count: 1,
      additions: 1,
      deletions: 0,
      changed_paths_json: null,
      created_at: "2026-07-23T00:00:00.000Z",
    });

    repos.upsertPipelineRun({
      id: "run_1",
      change_id: "chg_1",
      provider_run_id: "1001",
      workflow_name: "Backend CI",
      status: "completed",
      conclusion: "success",
      started_at: "2026-07-23T00:00:00.000Z",
      completed_at: "2026-07-23T00:05:00.000Z",
      html_url: "https://github.com/demo/lms/actions/runs/1001",
      is_primary: 1,
      emitted_trace_id: null,
      synced_at: "2026-07-23T00:06:00.000Z",
    });

    expect(() =>
      repos.upsertPipelineRun({
        id: "run_2",
        change_id: "chg_1",
        provider_run_id: "1002",
        workflow_name: "Frontend CI",
        status: "completed",
        conclusion: "success",
        started_at: "2026-07-23T00:00:00.000Z",
        completed_at: "2026-07-23T00:04:00.000Z",
        html_url: "https://github.com/demo/lms/actions/runs/1002",
        is_primary: 1,
        emitted_trace_id: null,
        synced_at: "2026-07-23T00:06:00.000Z",
      }),
    ).toThrow();
  });

  it("enforces one succeeded baseline deployment per service/environment", () => {
    const repos = setup();
    repos.upsertRepository({
      id: "repo_1",
      provider: "github",
      owner: "demo",
      name: "lms",
      default_branch: "main",
    });
    repos.upsertChange({
      id: "chg_1",
      repository_id: "repo_1",
      commit_sha: "b".repeat(40),
      short_sha: "bbbbbbb",
      branch: "main",
      commit_subject: "baseline",
      committed_at: "2026-07-23T00:00:00.000Z",
      ai_traceparent: null,
      ai_trace_id: null,
      ai_span_id: null,
      ai_trace_flags: null,
      ai_link_status: "missing",
      changed_files_count: 0,
      additions: 0,
      deletions: 0,
      changed_paths_json: null,
      created_at: "2026-07-23T00:00:00.000Z",
    });

    repos.insertDeployment({
      id: "dep_base",
      change_id: "chg_1",
      service_name: "lms-backend",
      environment_name: "hackathon-demo",
      role: "baseline",
      status: "succeeded",
      deployed_at: "2026-07-23T00:00:00.000Z",
      emitted_trace_id: null,
      created_at: "2026-07-23T00:00:00.000Z",
    });

    expect(() =>
      repos.insertDeployment({
        id: "dep_base_2",
        change_id: "chg_1",
        service_name: "lms-backend",
        environment_name: "hackathon-demo",
        role: "baseline",
        status: "succeeded",
        deployed_at: "2026-07-23T01:00:00.000Z",
        emitted_trace_id: null,
        created_at: "2026-07-23T01:00:00.000Z",
      }),
    ).toThrow();
  });

  it("rejects invalid ai_link_status values", () => {
    const repos = setup();
    repos.upsertRepository({
      id: "repo_1",
      provider: "github",
      owner: "demo",
      name: "lms",
      default_branch: "main",
    });

    expect(() =>
      repos.upsertChange({
        id: "chg_bad",
        repository_id: "repo_1",
        commit_sha: "c".repeat(40),
        short_sha: "ccccccc",
        branch: "main",
        commit_subject: "bad",
        committed_at: "2026-07-23T00:00:00.000Z",
        ai_traceparent: null,
        ai_trace_id: null,
        ai_span_id: null,
        ai_trace_flags: null,
        ai_link_status: "broken" as never,
        changed_files_count: 0,
        additions: 0,
        deletions: 0,
        changed_paths_json: null,
        created_at: "2026-07-23T00:00:00.000Z",
      }),
    ).toThrow();
  });
});
