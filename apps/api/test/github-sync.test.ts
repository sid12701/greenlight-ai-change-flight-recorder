import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { Repositories } from "../src/db/repositories/index.js";
import type { GitHubClient } from "../src/modules/github/client.js";
import { syncWorkflowRuns } from "../src/modules/github/sync.js";

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures/github/backend-success.json"), "utf8"),
);

describe("github sync", () => {
  let cleanup = () => {};

  afterEach(() => {
    cleanup();
  });

  function createRepos() {
    const dir = mkdtempSync(join(tmpdir(), "greenlight-sync-"));
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return Repositories.create(join(dir, "test.db"));
  }

  it("upserts change and primary pipeline run from recorded fixtures", async () => {
    const repos = createRepos();
    const github = {
      getWorkflowRun: async () => fixture.workflowRun,
      getWorkflowJobs: async () => fixture.jobs,
      getCommit: async () => ({
        sha: fixture.workflowRun.head_sha,
        commit: {
          message: "docs: proof\n\nAI-Traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
          author: { date: "2026-07-23T10:00:00.000Z" },
        },
      }),
    } as unknown as GitHubClient;

    const results = await syncWorkflowRuns({
      repos,
      github,
      repository: "demo/workload",
      runIds: [fixture.workflowRun.id],
      primaryWorkflowName: "Backend CI",
      verifyExport: async () => true,
      verifyAiSpan: async () => true,
    });

    expect(results).toHaveLength(1);
    const change = await repos.getChangeBySha(fixture.workflowRun.head_sha);
    expect(change?.ai_link_status).toBe("linked");
    expect(change?.ai_verification_state).toBe("verified");
    const runs = await repos.getPipelineRunsForChange(results[0].changeId);
    expect(runs).toHaveLength(1);
    expect(runs[0].is_primary).toBe(1);
    expect(runs[0].emitted_trace_id).toMatch(/^[0-9a-f]{32}$/);
    expect(runs[0].export_state).toBe("verified");
    expect(runs[0].duration_ms).toBe(290_000);
    expect(runs[0].slowest_step).toBe("Run tests");
  });

  it.each([
    {
      name: "absent",
      message: "chore: no AI session recorded",
      linkStatus: "missing",
      verificationState: "missing",
    },
    {
      name: "malformed",
      message: "chore: broken link\n\nAI-Traceparent: 00-not-a-real-traceparent",
      linkStatus: "invalid",
      verificationState: "invalid",
    },
  ])(
    "records an $name AI trailer distinctly rather than collapsing both to invalid",
    async ({ message, linkStatus, verificationState }) => {
      const repos = createRepos();
      const github = {
        getWorkflowRun: async () => fixture.workflowRun,
        getWorkflowJobs: async () => fixture.jobs,
        getCommit: async () => ({
          sha: fixture.workflowRun.head_sha,
          commit: { message, author: { date: "2026-07-23T10:00:00.000Z" } },
        }),
      } as unknown as GitHubClient;

      await syncWorkflowRuns({
        repos,
        github,
        repository: "demo/workload",
        runIds: [fixture.workflowRun.id],
        primaryWorkflowName: "Backend CI",
        verifyExport: async () => true,
        verifyAiSpan: async () => true,
      });

      const change = await repos.getChangeBySha(fixture.workflowRun.head_sha);
      expect(change?.ai_link_status).toBe(linkStatus);
      expect(change?.ai_verification_state).toBe(verificationState);
    },
  );

  it("fails closed without inserting a fabricated change when GitHub commit lookup fails", async () => {
    const repos = createRepos();
    const github = {
      getCommit: async () => {
        throw new Error("GitHub unavailable");
      },
    } as unknown as GitHubClient;

    await expect(
      import("../src/modules/github/sync.js").then(({ ensureChangeFromCommit }) =>
        ensureChangeFromCommit({
          repos,
          github,
          repository: "demo/workload",
          commitSha: "f".repeat(40),
        })),
    ).rejects.toThrow("GitHub unavailable");
    expect(await repos.getChangeBySha("f".repeat(40))).toBeUndefined();
  });

  it("exports every related workflow while keeping one configured primary", async () => {
    const repos = createRepos();
    const frontendFixture = JSON.parse(
      readFileSync(join(import.meta.dirname, "fixtures/github/frontend-success.json"), "utf8"),
    );
    const frontendRun = {
      ...frontendFixture.workflowRun,
      id: fixture.workflowRun.id + 1,
      head_sha: fixture.workflowRun.head_sha,
    };
    const github = {
      getWorkflowRun: async (runId: number) =>
        runId === fixture.workflowRun.id ? fixture.workflowRun : frontendRun,
      getWorkflowJobs: async (runId: number) =>
        runId === fixture.workflowRun.id ? fixture.jobs : frontendFixture.jobs,
      getCommit: async () => ({
        sha: fixture.workflowRun.head_sha,
        commit: {
          message: "docs: proof\n\nAI-Traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
          author: { date: "2026-07-23T10:00:00.000Z" },
        },
      }),
    } as unknown as GitHubClient;
    const verified: string[] = [];
    const result = await syncWorkflowRuns({
      repos,
      github,
      repository: "demo/workload",
      runIds: [fixture.workflowRun.id, frontendRun.id],
      primaryWorkflowName: "Backend CI",
      verifyExport: async (traceId) => {
        verified.push(traceId);
        return true;
      },
    });
    const runs = await repos.getPipelineRunsForChange(result[0].changeId);
    expect(runs).toHaveLength(2);
    expect(runs.filter((run) => run.is_primary === 1)).toHaveLength(1);
    expect(runs.every((run) => run.export_state === "verified")).toBe(true);
    expect(verified).toHaveLength(2);
  });

  // A workflow declaring `on: [push, pull_request]` produces two runs for one
  // commit on any branch with an open pull request. Refusing to pick between
  // them rejected the commit outright, so the change was never recorded and no
  // receipt existed — on a configuration most repositories use.
  it("syncs a commit whose primary workflow ran twice, taking the later run", async () => {
    const repos = createRepos();
    const pushRun = { ...fixture.workflowRun, workflow_id: 42 };
    const pullRequestRun = {
      ...fixture.workflowRun,
      workflow_id: 42,
      id: fixture.workflowRun.id + 1,
      updated_at: "2026-07-23T11:30:00Z",
    };
    const github = {
      getWorkflowRun: async (runId: number) =>
        runId === pushRun.id ? pushRun : pullRequestRun,
      getWorkflowJobs: async () => fixture.jobs,
      getCommit: async () => ({
        sha: fixture.workflowRun.head_sha,
        commit: {
          message: "chore: a commit whose workflow triggered twice",
          author: { date: "2026-07-23T10:00:00.000Z" },
        },
      }),
    } as unknown as GitHubClient;

    const result = await syncWorkflowRuns({
      repos,
      github,
      repository: "demo/workload",
      runIds: [pushRun.id, pullRequestRun.id],
      primaryWorkflowName: "Backend CI",
      verifyExport: async () => true,
    });

    const runs = await repos.getPipelineRunsForChange(result[0].changeId);
    // Both runs are kept; only which one is reported as primary is decided.
    expect(runs).toHaveLength(2);
    const primary = runs.filter((run) => run.is_primary === 1);
    expect(primary).toHaveLength(1);
    expect(primary[0].provider_run_id).toBe(String(pullRequestRun.id));
  });
});
