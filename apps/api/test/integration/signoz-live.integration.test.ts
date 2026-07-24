/**
 * Integration tests that run against a real SigNoz.
 *
 * These are the tests the audit found missing: everything else in the suite
 * mocks `fetch`, which is exactly how a query path that SigNoz rejects with
 * HTTP 400 shipped while every unit test passed.
 *
 * They are skipped unless SIGNOZ_API_KEY is set, so the default suite stays
 * hermetic, and are wired into `npm run test:integration`.
 */
import { afterAll, describe, expect, it } from "vitest";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Repositories } from "../../src/db/repositories/index.js";
import { SignozClient } from "../../src/modules/signoz/client.js";
import { syncWorkflowRuns } from "../../src/modules/github/sync.js";
import type { GitHubClient } from "../../src/modules/github/client.js";
import { temporaryDatabase } from "../support/config.js";

const SIGNOZ_URL = process.env.SIGNOZ_URL ?? "http://localhost:8080";
const SIGNOZ_API_KEY = process.env.SIGNOZ_API_KEY;
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";

const describeLive = SIGNOZ_API_KEY ? describe : describe.skip;

const cleanups: Array<() => void> = [];
afterAll(() => cleanups.forEach((fn) => fn()));

function liveClient() {
  return new SignozClient(SIGNOZ_URL, SIGNOZ_API_KEY as string, {
    maxAttempts: 3,
    requestTimeoutMs: 15_000,
  });
}

/** Polls until SigNoz has ingested the trace, or the budget expires. */
async function waitForTrace(
  client: SignozClient,
  traceId: string,
  expectedSpanCount: number,
  window: { startMs: number; endMs: number },
): Promise<boolean> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await client.verifyTrace({ traceId, expectedSpanCount, ...window })) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return false;
}

describeLive("signoz query contract (live)", () => {
  it("accepts the request shape the application sends", async () => {
    const client = liveClient();
    // A malformed request would come back as signoz_invalid_request, which is
    // precisely the failure the mocked tests could never surface.
    await expect(client.checkHealth()).resolves.toBe(true);
  });

  it("reports an unmatched window as absent, never as zero latency", async () => {
    const metrics = await liveClient().queryWindow({
      serviceName: "service-that-does-not-exist",
      serviceVersion: "0000000000000000000000000000000000000000",
      environmentName: "nowhere",
      route: "/does/not/exist",
      startMs: Date.now() - 600_000,
      endMs: Date.now(),
    });
    expect(metrics.requestCount).toBeNull();
    expect(metrics.p95Ms).toBeNull();
    expect(metrics.errorRatePercent).toBeNull();
  });

  it("rejects an invalid credential without retrying", async () => {
    const rejecting = new SignozClient(SIGNOZ_URL, "definitely-not-a-valid-key", {
      maxAttempts: 3,
    });
    await expect(rejecting.queryWindow({
      serviceName: "lms-backend",
      serviceVersion: "0000000000000000000000000000000000000000",
      environmentName: "hackathon-demo",
      route: "/api/v1/internal/home/overview",
      startMs: Date.now() - 600_000,
      endMs: Date.now(),
    })).rejects.toMatchObject({ code: "signoz_unauthorized", retryable: false });
  });
});

describeLive("reconstructed CI trace export (live)", () => {
  it("exports a workflow span tree through OTLP and verifies it in SigNoz", async () => {
    const fixture = JSON.parse(readFileSync(
      join(import.meta.dirname, "..", "fixtures", "github", "backend-success.json"),
      "utf8",
    ));
    // Reconstructed spans carry the workflow's own timestamps. Rebasing the
    // fixture onto the recent past keeps it inside SigNoz's retention while
    // still exercising the backdated-export path.
    const base = Date.now() - 10 * 60_000;
    const shift = base - Date.parse(fixture.workflowRun.run_started_at);
    const rebase = (iso: string | null) =>
      iso === null ? null : new Date(Date.parse(iso) + shift).toISOString();

    const run = {
      ...fixture.workflowRun,
      run_started_at: rebase(fixture.workflowRun.run_started_at),
      created_at: rebase(fixture.workflowRun.created_at),
      updated_at: rebase(fixture.workflowRun.updated_at),
    };
    const jobs = fixture.jobs.jobs.map((job: Record<string, unknown>) => ({
      ...job,
      started_at: rebase(job.started_at as string),
      completed_at: rebase(job.completed_at as string),
      steps: (job.steps as Array<Record<string, unknown>>).map((step) => ({
        ...step,
        started_at: rebase(step.started_at as string),
        completed_at: rebase(step.completed_at as string),
      })),
    }));

    const github = {
      getWorkflowRun: async () => run,
      getWorkflowJobs: async () => ({ jobs }),
      getCommit: async () => ({
        sha: run.head_sha,
        commit: {
          message: "feat: reconstructed trace export proof",
          author: { date: rebase(fixture.workflowRun.created_at) },
        },
      }),
    } as unknown as GitHubClient;

    const database = temporaryDatabase();
    cleanups.push(database.cleanup);
    const repos = Repositories.create(database.path);
    cleanups.push(async () => await repos.close());

    const client = liveClient();
    let verifiedTraceId = "";
    let verifiedSpanCount = 0;

    const results = await syncWorkflowRuns({
      repos,
      github,
      repository: "demo/lms",
      runIds: [run.id],
      primaryWorkflowName: run.name,
      defaultBranch: "main",
      exporterFactory: () => new OTLPTraceExporter({ url: `${OTLP_ENDPOINT}/v1/traces` }),
      verifyExport: async (traceId, spanCount, startMs, endMs) => {
        verifiedTraceId = traceId;
        verifiedSpanCount = spanCount;
        return waitForTrace(client, traceId, spanCount, { startMs, endMs });
      },
    });

    expect(results).toHaveLength(1);

    // The fixture is one run, one job, two steps.
    expect(verifiedSpanCount).toBe(4);

    const stored = await repos.getPipelineRunsForChange(results[0].changeId);
    expect(stored).toHaveLength(1);
    expect(stored[0].export_state).toBe("verified");
    expect(stored[0].emitted_trace_id).toBe(verifiedTraceId);
    expect(stored[0].verified_at).not.toBeNull();

    // The trace must carry the reconstruction marker so it is never mistaken
    // for telemetry the CI provider emitted itself.
    const described = await client.describeTrace({
      traceId: verifiedTraceId,
      startMs: base - 120_000,
      endMs: Date.now() + 120_000,
    });
    expect(described.spanCount).toBeGreaterThanOrEqual(4);
    expect(described.services).toContain("greenlight-ci");
  }, 120_000);
});
