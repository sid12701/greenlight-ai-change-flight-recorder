import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GitHubClient } from "../src/modules/github/client.js";
import {
  findSlowestStep,
  normalizeWorkflowRun,
  parseGitHubTimestamp,
  toHrTime,
} from "../src/modules/github/normalize.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/github");

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

describe("github normalization", () => {
  it("normalizes workflow, jobs, and steps with UTC timestamps", () => {
    const fixture = loadFixture("backend-success.json");
    const normalized = normalizeWorkflowRun(fixture.workflowRun, fixture.jobs.jobs);

    expect(normalized.workflowName).toBe("Backend CI");
    expect(normalized.startedAtMs).toBe(Date.parse("2026-07-23T10:00:10+00:00"));
    expect(normalized.completedAtMs).toBe(Date.parse("2026-07-23T10:05:00+00:00"));
    expect(normalized.jobs[0].steps[1].durationMs).toBe(225_000);
    expect(toHrTime(normalized.startedAtMs!)).toEqual([
      Math.floor(Date.parse("2026-07-23T10:00:10+00:00") / 1_000),
      0,
    ]);
  });

  it("finds the slowest step", () => {
    const fixture = loadFixture("backend-success.json");
    const normalized = normalizeWorkflowRun(fixture.workflowRun, fixture.jobs.jobs);
    expect(findSlowestStep(normalized)?.name).toBe("Run tests");
  });

  it("maps failed conclusions without requesting logs", () => {
    const fixture = loadFixture("backend-failed.json");
    const normalized = normalizeWorkflowRun(fixture.workflowRun, fixture.jobs.jobs);
    expect(normalized.conclusion).toBe("failure");
    expect(normalized.jobs[0].conclusion).toBe("failure");
  });

  it("retries 429 responses once", async () => {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response("rate limited", { status: 429 });
      }
      return new Response(
        JSON.stringify(loadFixture("backend-success.json").workflowRun),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const client = new GitHubClient({
      token: "test-token",
      repository: "demo/lms",
      fetchImpl,
    });

    const run = await client.getWorkflowRun(123456789);
    expect(run.name).toBe("Backend CI");
    expect(attempts).toBe(2);
  });

  it("omits authorization for public repositories when no token is configured", async () => {
    let authorization: string | null = "unexpected";
    const fetchImpl = async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      authorization = new Headers(init?.headers).get("authorization");
      return new Response(
        JSON.stringify(loadFixture("backend-success.json").workflowRun),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    const client = new GitHubClient({
      repository: "demo/public-repository",
      fetchImpl,
    });

    await client.getWorkflowRun(123456789);
    expect(authorization).toBeNull();
  });

  it("handles missing timestamps defensively", () => {
    expect(parseGitHubTimestamp(null)).toBeNull();
    expect(parseGitHubTimestamp(undefined)).toBeNull();
  });

  it("follows GitHub pagination links with bounded requests", async () => {
    const fixture = loadFixture("backend-success.json").workflowRun;
    const requests: string[] = [];
    const fetchImpl = async (url: string | URL | Request) => {
      requests.push(String(url));
      const page = requests.length;
      return new Response(
        JSON.stringify({ workflow_runs: [{ ...fixture, id: page }] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...(page === 1
              ? { Link: '<https://api.github.com/page-2>; rel="next"' }
              : {}),
          },
        },
      );
    };
    const client = new GitHubClient({
      token: "test-token",
      repository: "demo/lms",
      fetchImpl,
      sleepImpl: async () => {},
    });
    const result = await client.listWorkflowRuns({ branch: "main" });
    expect(result.workflow_runs.map((run) => run.id)).toEqual([1, 2]);
    expect(requests).toHaveLength(2);
  });

  it("rejects malformed GitHub timestamps", () => {
    expect(() => parseGitHubTimestamp("not-a-date")).toThrow("Invalid GitHub timestamp");
  });
});
