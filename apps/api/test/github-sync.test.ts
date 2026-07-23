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
      repository: "demo/lms",
      runIds: [fixture.workflowRun.id],
      primaryWorkflowName: "Backend CI",
    });

    expect(results).toHaveLength(1);
    const change = repos.getChangeBySha(fixture.workflowRun.head_sha);
    expect(change?.ai_link_status).toBe("linked");
    const runs = repos.getPipelineRunsForChange(results[0].changeId);
    expect(runs).toHaveLength(1);
    expect(runs[0].is_primary).toBe(1);
    expect(runs[0].emitted_trace_id).toMatch(/^[0-9a-f]{32}$/);
  });
});
