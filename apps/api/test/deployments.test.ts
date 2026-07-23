import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config.js";
import { Repositories } from "../src/db/repositories/index.js";
import { buildServer } from "../src/server.js";
import { DeploymentService } from "../src/modules/deployments/service.js";

const config = {
  GREENLIGHT_PORT: 4000,
  GREENLIGHT_DATABASE_PATH: "",
  GREENLIGHT_ADMIN_TOKEN: "test-admin-token",
  GITHUB_TOKEN: "test-github-token",
  GITHUB_REPOSITORY: "demo/lms",
  GREENLIGHT_PRIMARY_WORKFLOW_NAME: "Backend CI",
  SIGNOZ_URL: "http://localhost:8080",
  SIGNOZ_API_KEY: "test-signoz",
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
  OTEL_SERVICE_NAME: "greenlight-api",
  LMS_PATH: "/tmp/lms",
  LMS_DEMO_BRANCH: "greenlight-demo",
  GREENLIGHT_BASELINE_WINDOW_SECONDS: 90,
  GREENLIGHT_WARMUP_SECONDS: 15,
  GREENLIGHT_OBSERVED_WINDOW_SECONDS: 90,
  GREENLIGHT_MIN_SPANS: 200,
} satisfies AppConfig;

describe("deployment routes", () => {
  let dbPath = "";
  let cleanup = () => {};

  afterEach(() => {
    cleanup();
  });

  function seed() {
    const dir = mkdtempSync(join(tmpdir(), "greenlight-api-"));
    dbPath = join(dir, "test.db");
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    config.GREENLIGHT_DATABASE_PATH = dbPath;
    const repos = Repositories.create(dbPath);
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
      commit_sha: "d".repeat(40),
      short_sha: "ddddddd",
      branch: "main",
      commit_subject: "deploy",
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
    return repos;
  }

  it("requires bearer auth for deployment recording", async () => {
    seed();
    const app = buildServer(config);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/deployments",
      payload: {
        repository: "demo/lms",
        commitSha: "d".repeat(40),
        serviceName: "lms-backend",
        environmentName: "hackathon-demo",
        role: "candidate",
        status: "succeeded",
        deployedAt: "2026-07-23T12:00:00.000Z",
      },
    });
    expect(response.statusCode).toBe(401);
  });

  it("records deployments through the service with health and version checks", async () => {
    const repos = seed();
    const service = new DeploymentService(
      repos,
      async () => true,
      async () => true,
    );
    const result = await service.recordDeployment({
      repository: "demo/lms",
      commitSha: "d".repeat(40),
      serviceName: "lms-backend",
      environmentName: "hackathon-demo",
      role: "baseline",
      status: "succeeded",
      deployedAt: "2026-07-23T12:00:00.000Z",
    });
    expect(result.deploymentId).toContain("dep_");
  });
});
