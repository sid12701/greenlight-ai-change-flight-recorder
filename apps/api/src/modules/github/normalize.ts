import type { GitHubJob, GitHubWorkflowRun } from "./client.js";

export interface NormalizedStep {
  name: string;
  number: number;
  status: string;
  conclusion: string | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  durationMs: number | null;
}

export interface NormalizedJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  durationMs: number | null;
  htmlUrl: string;
  steps: NormalizedStep[];
}

export interface NormalizedWorkflowRun {
  providerRunId: string;
  workflowName: string;
  headSha: string;
  headBranch: string | null;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  startedAtMs: number | null;
  completedAtMs: number | null;
  durationMs: number | null;
  jobs: NormalizedJob[];
}

export function parseGitHubTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  return Date.parse(value);
}

export function toEpochNanos(epochMs: number): number {
  return epochMs * 1_000_000;
}

export function durationMs(
  startMs: number | null,
  endMs: number | null,
): number | null {
  if (startMs === null || endMs === null) {
    return null;
  }
  return Math.max(0, endMs - startMs);
}

function normalizeStep(step: GitHubJob["steps"][number]): NormalizedStep {
  const startedAtMs = parseGitHubTimestamp(step.started_at);
  const completedAtMs = parseGitHubTimestamp(step.completed_at);
  return {
    name: step.name,
    number: step.number,
    status: step.status,
    conclusion: step.conclusion,
    startedAtMs,
    completedAtMs,
    durationMs: durationMs(startedAtMs, completedAtMs),
  };
}

function normalizeJob(job: GitHubJob): NormalizedJob {
  const startedAtMs = parseGitHubTimestamp(job.started_at);
  const completedAtMs = parseGitHubTimestamp(job.completed_at);
  return {
    id: job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    startedAtMs,
    completedAtMs,
    durationMs: durationMs(startedAtMs, completedAtMs),
    htmlUrl: job.html_url,
    steps: job.steps.map(normalizeStep),
  };
}

export function normalizeWorkflowRun(
  run: GitHubWorkflowRun,
  jobs: GitHubJob[],
): NormalizedWorkflowRun {
  const normalizedJobs = jobs.map(normalizeJob);
  const startedAtMs =
    normalizedJobs
      .map((job) => job.startedAtMs)
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b)[0] ??
    parseGitHubTimestamp(run.run_started_at ?? run.created_at);
  const completedAtMs =
    normalizedJobs
      .map((job) => job.completedAtMs)
      .filter((value): value is number => value !== null)
      .sort((a, b) => b - a)[0] ?? parseGitHubTimestamp(run.updated_at);

  return {
    providerRunId: String(run.id),
    workflowName: run.name,
    headSha: run.head_sha,
    headBranch: run.head_branch,
    status: run.status,
    conclusion: run.conclusion,
    htmlUrl: run.html_url,
    startedAtMs,
    completedAtMs,
    durationMs: durationMs(startedAtMs, completedAtMs),
    jobs: normalizedJobs,
  };
}

export function findSlowestStep(run: NormalizedWorkflowRun): NormalizedStep | null {
  let slowest: NormalizedStep | null = null;
  for (const job of run.jobs) {
    for (const step of job.steps) {
      if (step.durationMs === null) {
        continue;
      }
      if (!slowest || step.durationMs > (slowest.durationMs ?? 0)) {
        slowest = step;
      }
    }
  }
  return slowest;
}
