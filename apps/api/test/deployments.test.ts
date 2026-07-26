import { afterEach, describe, expect, it } from "vitest";
import type {
  ReadableSpan,
  SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { Repositories } from "../src/db/repositories/index.js";
import { buildServer } from "../src/app.js";
import { DeploymentService } from "../src/modules/deployments/service.js";
import { temporaryDatabase, testConfig } from "./support/config.js";

let config = testConfig();

describe("deployment routes", () => {
  let dbPath = "";
  let cleanup = () => {};

  afterEach(() => {
    cleanup();
  });

  async function seed() {
    const database = temporaryDatabase();
    dbPath = database.path;
    cleanup = database.cleanup;
    config = testConfig({ GREENLIGHT_DATABASE_PATH: dbPath });
    const repos = Repositories.create(dbPath);
    await repos.upsertRepository({
      id: "repo_1",
      provider: "github",
      owner: "demo",
      name: "workload",
      default_branch: "main",
    });
    await repos.upsertChange({
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
    await seed();
    const app = await buildServer(config);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/deployments",
      payload: {
        repository: "demo/workload",
        commitSha: "d".repeat(40),
        serviceName: "blnk-loan-workload",
        environmentName: "hackathon-demo",
        role: "candidate",
        status: "succeeded",
        deployedAt: "2026-07-23T12:00:00.000Z",
      },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("records deployments through the service with health and version checks", async () => {
    const repos = await seed();
    let checkedUrl = "";
    const service = new DeploymentService(
      repos,
      async (url) => {
        checkedUrl = url;
        return true;
      },
      async () => true,
      undefined,
      { allowedHealthOrigins: ["http://workload.test:9081"] },
    );
    const result = await service.recordDeployment({
      repository: "demo/workload",
      commitSha: "d".repeat(40),
      serviceName: "blnk-loan-workload",
      environmentName: "hackathon-demo",
      route: "/api/v1/internal/home/overview",
      healthUrl: "http://workload.test:9081/actuator/health",
      imageDigest: `sha256:${"a".repeat(64)}`,
      idempotencyKey: "deploy-test-baseline",
      provider: "test",
      role: "baseline",
      status: "succeeded",
      deployedAt: "2026-07-23T12:00:00.000Z",
    });
    expect(result.deploymentId).toContain("dep_");
    expect(checkedUrl).toBe("http://workload.test:9081/actuator/health");

    const replay = await service.recordDeployment({
      repository: "demo/workload",
      commitSha: "d".repeat(40),
      serviceName: "blnk-loan-workload",
      environmentName: "hackathon-demo",
      route: "/api/v1/internal/home/overview",
      healthUrl: "http://workload.test:9081/actuator/health",
      imageDigest: `sha256:${"a".repeat(64)}`,
      idempotencyKey: "deploy-test-baseline",
      provider: "test",
      role: "baseline",
      status: "succeeded",
      deployedAt: "2026-07-23T12:00:00.000Z",
    });
    expect(replay.replayed).toBe(true);
    expect(await repos.getDeploymentsForChange("chg_1")).toHaveLength(1);
  });

  it("fails closed when the exact deployed version is not visible", async () => {
    const repos = await seed();
    const service = new DeploymentService(
      repos,
      async () => true,
      async () => false,
      undefined,
      {
        versionVisibilityTimeoutMs: 10,
        allowedHealthOrigins: ["http://workload.test:9081"],
      },
    );
    await expect(service.recordDeployment({
      repository: "demo/workload",
      commitSha: "d".repeat(40),
      serviceName: "blnk-loan-workload",
      environmentName: "hackathon-demo",
      route: "/api/v1/internal/home/overview",
      healthUrl: "http://workload.test:9081/actuator/health",
      imageDigest: `sha256:${"a".repeat(64)}`,
      idempotencyKey: "deploy-unverified-version",
      provider: "test",
      role: "candidate",
      status: "succeeded",
      deployedAt: "2026-07-23T12:00:00.000Z",
    })).rejects.toThrow(/not yet visible in SigNoz/);
    expect(await repos.getDeploymentsForChange("chg_1")).toHaveLength(0);
  });

  it("rejects deployment health checks outside the configured origin allowlist", async () => {
    const repos = await seed();
    let called = false;
    const service = new DeploymentService(
      repos,
      async () => {
        called = true;
        return true;
      },
      async () => true,
      undefined,
      { allowedHealthOrigins: ["https://deployments.internal.example"] },
    );

    await expect(service.recordDeployment({
      repository: "demo/workload",
      commitSha: "d".repeat(40),
      serviceName: "blnk-loan-workload",
      environmentName: "hackathon-demo",
      route: "/api/v1/internal/home/overview",
      healthUrl: "http://169.254.169.254/latest/meta-data",
      imageDigest: `sha256:${"a".repeat(64)}`,
      idempotencyKey: "deploy-forbidden-health-origin",
      provider: "test",
      role: "candidate",
      status: "succeeded",
      deployedAt: "2026-07-23T12:00:00.000Z",
    })).rejects.toThrow(/not in the configured allowlist/);
    expect(called).toBe(false);
  });

  it("emits deployment markers under the deployed workload's resource identity", async () => {
    const repos = await seed();
    const spans: ReadableSpan[] = [];
    const exporter: SpanExporter = {
      export(batch, callback) {
        spans.push(...batch);
        callback({ code: 0 });
      },
      async shutdown() {},
    };
    let verifiedTraceId = "";
    let expectedSpanCount = 0;
    const service = new DeploymentService(
      repos,
      async () => true,
      async () => true,
      undefined,
      {
        allowedHealthOrigins: ["http://workload.test:9081"],
        exporterFactory: () => exporter,
        verifyTrace: async (traceId, spanCount) => {
          verifiedTraceId = traceId;
          expectedSpanCount = spanCount;
          return true;
        },
      },
    );

    const result = await service.recordDeployment({
      repository: "demo/workload",
      commitSha: "d".repeat(40),
      serviceName: "blnk-loan-workload",
      environmentName: "hackathon-demo",
      route: "/api/v1/internal/home/overview",
      healthUrl: "http://workload.test:9081/actuator/health",
      imageDigest: `sha256:${"b".repeat(64)}`,
      idempotencyKey: "deploy-trace-verification",
      provider: "test",
      role: "candidate",
      status: "succeeded",
      deployedAt: "2026-07-23T12:00:00.000Z",
    });

    expect(result.traceState).toBe("verified");
    expect(expectedSpanCount).toBe(2);
    expect(spans.map((span) => span.name).sort()).toEqual([
      "deployment.started",
      "deployment.succeeded",
    ]);
    expect(new Set(spans.map((span) => span.spanContext().traceId))).toEqual(
      new Set([verifiedTraceId]),
    );
    // Deployment-impact queries filter on the workload's service name,
    // version and environment; a marker emitted under the worker's identity
    // could never be correlated with the telemetry it marks.
    expect(spans[0].resource.attributes["service.name"]).toBe("blnk-loan-workload");
    expect(spans[0].resource.attributes["service.version"]).toBe("d".repeat(40));
    expect(spans[0].resource.attributes["deployment.environment.name"]).toBe("hackathon-demo");
  });

  describe("re-baselining", () => {
    function baselineService(repos: Repositories, healthy = true) {
      return new DeploymentService(
        repos,
        async () => healthy,
        async () => true,
        undefined,
        { allowedHealthOrigins: ["http://workload.test:9081"] },
      );
    }

    const baseline = (idempotencyKey: string, extra: Record<string, unknown> = {}) => ({
      repository: "demo/workload",
      commitSha: "d".repeat(40),
      serviceName: "blnk-loan-workload",
      environmentName: "hackathon-demo",
      route: "/api/v1/internal/home/overview",
      healthUrl: "http://workload.test:9081/actuator/health",
      imageDigest: `sha256:${"a".repeat(64)}`,
      idempotencyKey,
      provider: "test",
      role: "baseline" as const,
      status: "succeeded" as const,
      deployedAt: "2026-07-23T12:00:00.000Z",
      ...extra,
    });

    // The default is unchanged: an accidental repeat must not move the point
    // every future verdict is measured against.
    it("still refuses a second baseline that does not ask to replace the first", async () => {
      const repos = await seed();
      const service = baselineService(repos);
      await service.recordDeployment(baseline("baseline-first"));
      await expect(service.recordDeployment(baseline("baseline-second")))
        .rejects.toThrow(/already exists/);
      const active = await repos.listBaselineDeployments("blnk-loan-workload", "hackathon-demo");
      expect(active).toHaveLength(1);
    });

    it("retires the previous baseline when asked, and resolves to the new one", async () => {
      const repos = await seed();
      const service = baselineService(repos);
      const first = await service.recordDeployment(baseline("baseline-first"));
      const second = await service.recordDeployment(
        baseline("baseline-second", { supersedeBaseline: true }),
      );

      const active = await repos.listBaselineDeployments("blnk-loan-workload", "hackathon-demo");
      expect(active.map((row) => row.id)).toEqual([second.deploymentId]);

      // Retired, not deleted: an evaluation citing it is still explainable
      // with the baseline it was actually measured against.
      const retired = await repos.getDeploymentById(first.deploymentId);
      expect(retired?.superseded_at).toEqual(expect.any(String));
      expect(retired?.role).toBe("baseline");
    });

    // A replacement that never proved healthy must not leave the service with
    // no baseline at all.
    it("keeps the existing baseline active when the replacement fails", async () => {
      const repos = await seed();
      const first = await baselineService(repos).recordDeployment(baseline("baseline-first"));

      await expect(
        baselineService(repos, false).recordDeployment(
          baseline("baseline-doomed", { supersedeBaseline: true }),
        ),
      ).rejects.toThrow(/health check failed/);

      const active = await repos.listBaselineDeployments("blnk-loan-workload", "hackathon-demo");
      expect(active.map((row) => row.id)).toEqual([first.deploymentId]);
    });

    it("ignores the flag for roles that are not baselines", async () => {
      const repos = await seed();
      const service = baselineService(repos);
      const first = await service.recordDeployment(baseline("baseline-first"));
      await service.recordDeployment(
        baseline("candidate-one", { role: "candidate", supersedeBaseline: true }),
      );
      const active = await repos.listBaselineDeployments("blnk-loan-workload", "hackathon-demo");
      expect(active.map((row) => row.id)).toEqual([first.deploymentId]);
    });
  });
});
