import { afterEach, describe, expect, it } from "vitest";
import { Repositories } from "../src/db/repositories/index.js";
import { RegressionService } from "../src/modules/regressions/service.js";
import {
  SignozIntegrationError,
  type SignozClient,
  type WindowMetrics,
} from "../src/modules/signoz/client.js";
import { temporaryDatabase, testConfig } from "./support/config.js";

describe("deterministic regression service", () => {
  let cleanup = () => {};
  afterEach(() => cleanup());

  it("anchors immutable windows to readiness and reuses one baseline for recovery", async () => {
    const database = temporaryDatabase();
    cleanup = database.cleanup;
    const repos = Repositories.create(database.path);
    const config = testConfig({
      GREENLIGHT_DATABASE_PATH: database.path,
      GREENLIGHT_MIN_SPANS: "123",
    });
    await repos.upsertRepository({
      id: "repo_1",
      provider: "github",
      owner: "demo",
      name: "lms",
      default_branch: "main",
    });
    const versions = {
      baseline: "a".repeat(40),
      candidate: "b".repeat(40),
      recovery: "c".repeat(40),
    };
    for (const [role, sha] of Object.entries(versions)) {
      await repos.upsertChange({
        id: `chg_${role}`,
        repository_id: "repo_1",
        commit_sha: sha,
        short_sha: sha.slice(0, 7),
        branch: "main",
        commit_subject: role,
        committed_at: "2026-07-23T09:00:00.000Z",
        ai_traceparent: null,
        ai_trace_id: null,
        ai_span_id: null,
        ai_trace_flags: null,
        ai_link_status: "missing",
        changed_files_count: 0,
        additions: 0,
        deletions: 0,
        changed_paths_json: null,
        created_at: "2026-07-23T09:00:00.000Z",
      });
    }
    const deployments = [
      ["dep_base", "chg_baseline", "baseline", "2026-07-23T10:00:00.000Z"],
      ["dep_bad", "chg_candidate", "candidate", "2026-07-23T12:00:00.000Z"],
      ["dep_recovery", "chg_recovery", "recovery", "2026-07-23T14:00:00.000Z"],
    ] as const;
    for (const [id, changeId, role, readiness] of deployments) {
      await repos.insertDeployment({
        id,
        change_id: changeId,
        service_name: "lms-backend",
        environment_name: "hackathon-demo",
        role,
        status: "succeeded",
        deployed_at: readiness,
        readiness_at: readiness,
        version_state: "verified",
        emitted_trace_id: null,
        created_at: readiness,
      });
    }

    const results: WindowMetrics[] = [
      { requestCount: 200, errorCount: 2, p90Ms: 90, p95Ms: 100, errorRatePercent: 1 },
      { requestCount: 200, errorCount: 16, p90Ms: 450, p95Ms: 500, errorRatePercent: 8 },
      { requestCount: 200, errorCount: 3, p90Ms: 95, p95Ms: 110, errorRatePercent: 1.5 },
    ];
    const queriedWindows: Array<{ startMs: number; endMs: number; serviceVersion: string }> = [];
    const signoz = {
      queryWindow: async (window: { startMs: number; endMs: number; serviceVersion: string }) => {
        queriedWindows.push(window);
        return results.shift() as WindowMetrics;
      },
      querySlowTraceIds: async () => [],
      verifyTrace: async () => true,
      buildDashboardUrl: () => null,
      buildTraceUrl: (traceId: string) => `http://signoz.test/trace/${traceId}`,
    } as unknown as SignozClient;
    let nowMs = Date.parse("2026-07-23T13:00:00.000Z");
    const service = new RegressionService(repos, signoz, config, () => nowMs);
    const candidate = await service.evaluate({
      deploymentId: "dep_bad",
      baselineDeploymentId: "dep_base",
      route: "/api/v1/internal/home/overview",
    });
    expect(candidate.status).toBe("regressed");
    expect(candidate.thresholds.minSpans).toBe(123);
    expect(queriedWindows[0]).toMatchObject({
      startMs: Date.parse("2026-07-23T10:00:15.000Z"),
      endMs: Date.parse("2026-07-23T10:01:45.000Z"),
      serviceVersion: versions.baseline,
    });
    expect(queriedWindows[1]).toMatchObject({
      startMs: Date.parse("2026-07-23T12:00:15.000Z"),
      endMs: Date.parse("2026-07-23T12:01:45.000Z"),
      serviceVersion: versions.candidate,
    });

    nowMs = Date.parse("2026-07-23T15:00:00.000Z");
    const recovery = await service.evaluate({
      deploymentId: "dep_recovery",
      incidentId: candidate.incidentId as string,
      route: "/api/v1/internal/home/overview",
      comparisonKind: "recovery",
    });
    expect(recovery.status).toBe("recovered");
    const candidateRow = await repos.getLatestEvaluationForDeployment("dep_bad");
    const recoveryRow = await repos.getLatestEvaluationForDeployment("dep_recovery");
    expect(recoveryRow?.baseline_snapshot_id).toBe(candidateRow?.baseline_snapshot_id);
    expect(recoveryRow?.baseline_start).toBe(candidateRow?.baseline_start);
    expect(recoveryRow?.baseline_end).toBe(candidateRow?.baseline_end);
    expect(recoveryRow?.observed_service_version).toBe(versions.recovery);
    expect(JSON.parse(recoveryRow?.thresholds_json ?? "{}").minSpans).toBe(123);
    await repos.close();
  });

  it("rejects evaluation before the persisted observed window is complete", async () => {
    const database = temporaryDatabase();
    cleanup = database.cleanup;
    const repos = Repositories.create(database.path);
    const config = testConfig({ GREENLIGHT_DATABASE_PATH: database.path });
    await repos.upsertRepository({
      id: "repo_1", provider: "github", owner: "demo", name: "lms", default_branch: "main",
    });
    for (const [id, sha] of [["base", "a".repeat(40)], ["bad", "b".repeat(40)]]) {
      await repos.upsertChange({
        id: `chg_${id}`, repository_id: "repo_1", commit_sha: sha, short_sha: sha.slice(0, 7),
        branch: "main", commit_subject: id, committed_at: "2026-07-23T09:00:00.000Z",
        ai_traceparent: null, ai_trace_id: null, ai_span_id: null, ai_trace_flags: null,
        ai_link_status: "missing", changed_files_count: 0, additions: 0, deletions: 0,
        changed_paths_json: null, created_at: "2026-07-23T09:00:00.000Z",
      });
    }
    await repos.insertDeployment({
      id: "dep_base", change_id: "chg_base", service_name: "lms-backend",
      environment_name: "hackathon-demo", role: "baseline", status: "succeeded",
      deployed_at: "2026-07-23T10:00:00.000Z", readiness_at: "2026-07-23T10:00:00.000Z",
      version_state: "verified", emitted_trace_id: null, created_at: "2026-07-23T10:00:00.000Z",
    });
    await repos.insertDeployment({
      id: "dep_bad", change_id: "chg_bad", service_name: "lms-backend",
      environment_name: "hackathon-demo", role: "candidate", status: "succeeded",
      deployed_at: "2026-07-23T12:00:00.000Z", readiness_at: "2026-07-23T12:00:00.000Z",
      version_state: "verified", emitted_trace_id: null, created_at: "2026-07-23T12:00:00.000Z",
    });
    const signoz = {
      queryWindow: async () => ({
        requestCount: 200,
        errorCount: 2,
        p90Ms: 90,
        p95Ms: 100,
        errorRatePercent: 1,
      }),
      querySlowTraceIds: async () => [],
      verifyTrace: async () => true,
      buildDashboardUrl: () => null,
    } as unknown as SignozClient;
    const service = new RegressionService(
      repos,
      signoz,
      config,
      () => Date.parse("2026-07-23T12:01:00.000Z"),
    );
    await expect(service.evaluate({
      deploymentId: "dep_bad",
      baselineDeploymentId: "dep_base",
      route: "/api/v1/internal/home/overview",
    })).rejects.toMatchObject({
      code: "evaluation_window_incomplete",
      retryable: true,
      // The scheduler reads the deadline from the error, never from its text.
      retryAt: "2026-07-23T12:02:00.000Z",
    });
    await repos.close();
  });

  /**
   * The load-bearing claim of the whole product is that a verdict is a SigNoz
   * answer and nothing else — no cached value, no local estimate, no
   * "probably fine". If SigNoz cannot answer, the only honest output is that it
   * could not answer.
   *
   * This is asserted rather than assumed because the failure it guards against
   * is silent: a future fallback that returns stale or synthesised metrics
   * would still produce a green-looking receipt, and nothing else in the suite
   * would notice.
   */
  it("records an integration error, never a verdict, when SigNoz cannot answer", async () => {
    const database = temporaryDatabase();
    cleanup = database.cleanup;
    const repos = Repositories.create(database.path);
    const config = testConfig({ GREENLIGHT_DATABASE_PATH: database.path });
    await repos.upsertRepository({
      id: "repo_1",
      provider: "github",
      owner: "demo",
      name: "lms",
      default_branch: "main",
    });
    const versions = { baseline: "a".repeat(40), candidate: "b".repeat(40) };
    for (const [role, sha] of Object.entries(versions)) {
      await repos.upsertChange({
        id: `chg_${role}`,
        repository_id: "repo_1",
        commit_sha: sha,
        short_sha: sha.slice(0, 7),
        branch: "main",
        commit_subject: role,
        committed_at: "2026-07-23T09:00:00.000Z",
        ai_traceparent: null,
        ai_trace_id: null,
        ai_span_id: null,
        ai_trace_flags: null,
        ai_link_status: "missing",
        changed_files_count: 0,
        additions: 0,
        deletions: 0,
        changed_paths_json: null,
        created_at: "2026-07-23T09:00:00.000Z",
      });
    }
    for (const [id, changeId, role, readiness] of [
      ["dep_base", "chg_baseline", "baseline", "2026-07-23T10:00:00.000Z"],
      ["dep_bad", "chg_candidate", "candidate", "2026-07-23T12:00:00.000Z"],
    ] as const) {
      await repos.insertDeployment({
        id,
        change_id: changeId,
        service_name: "lms-backend",
        environment_name: "hackathon-demo",
        role,
        status: "succeeded",
        deployed_at: readiness,
        readiness_at: readiness,
        version_state: "verified",
        emitted_trace_id: null,
        created_at: readiness,
      });
    }

    // The baseline window answers so a snapshot exists; the observed window is
    // where SigNoz goes away, which is the case that could otherwise be papered
    // over with the baseline's own numbers.
    let call = 0;
    const signoz = {
      queryWindow: async () => {
        call += 1;
        if (call === 1) {
          return {
            requestCount: 200,
            errorCount: 2,
            p90Ms: 90,
            p95Ms: 100,
            errorRatePercent: 1,
          } satisfies WindowMetrics;
        }
        throw new SignozIntegrationError("connect ECONNREFUSED", "signoz_unavailable");
      },
      querySlowTraceIds: async () => ["f".repeat(32)],
      verifyTrace: async () => true,
      buildDashboardUrl: () => "http://signoz.test/dashboard",
      buildTraceUrl: (traceId: string) => `http://signoz.test/trace/${traceId}`,
    } as unknown as SignozClient;

    const service = new RegressionService(
      repos,
      signoz,
      config,
      () => Date.parse("2026-07-23T13:00:00.000Z"),
    );
    // The caller is told the dependency failed rather than handed a verdict
    // object it might render, and the outcome is still recorded.
    await expect(service.evaluate({
      deploymentId: "dep_bad",
      baselineDeploymentId: "dep_base",
      route: "/api/v1/internal/home/overview",
    })).rejects.toMatchObject({ code: "signoz_unavailable" });

    const row = await repos.getLatestEvaluationForDeployment("dep_bad");
    expect(row?.status).toBe("integration_error");
    expect(row?.integration_error_code).toBe("signoz_unavailable");
    // No metric may survive a failed query. A receipt showing the baseline's
    // p95 beside an unmeasured observation reads as "nothing moved".
    expect(row?.observed_p95_ms).toBeNull();
    expect(row?.baseline_p95_ms).toBeNull();
    expect(row?.observed_error_rate).toBeNull();
    expect(row?.latency_delta_pct).toBeNull();
    // Nor may evidence: a link is only publishable once its span resolved.
    expect(await repos.getEvidenceLinksForEvaluation(row?.id as string)).toEqual([]);
    expect(row?.signoz_dashboard_url).toBeNull();

    await repos.close();
  });
});
