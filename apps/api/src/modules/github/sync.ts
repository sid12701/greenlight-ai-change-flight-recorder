import {
  extractAiTraceparentFromMessage,
  type AiLinkStatus,
} from "@greenlight/shared";
import type { Repositories } from "../../db/repositories/index.js";
import {
  shouldSkipEmission,
  synthesizeCiTrace,
} from "../ci-telemetry/synthesizer.js";
import { shouldAttachAiLink } from "../ci-telemetry/link.js";
import type { GitHubClient } from "./client.js";
import { markPrimaryRuns } from "./primary-workflow.js";
import { normalizeWorkflowRun } from "./normalize.js";

export interface SyncWorkflowRunsInput {
  repos: Repositories;
  github: GitHubClient;
  repository: string;
  runIds: number[];
  primaryWorkflowName: string;
  defaultBranch?: string;
  reconstructionAtMs?: number;
}

export interface SyncedChangeResult {
  changeId: string;
  commitSha: string;
  pipelineRunIds: string[];
  warnings: string[];
}

function parseRepository(repository: string) {
  const [owner, name] = repository.split("/");
  if (!owner || !name) {
    throw new Error("repository must be owner/name");
  }
  return { owner, name };
}

function deriveAiLinkStatus(parsed: ReturnType<typeof extractAiTraceparentFromMessage>): AiLinkStatus {
  if (!parsed) {
    return "missing";
  }
  return parsed.ok ? "linked" : "invalid";
}

export async function ensureChangeFromCommit(input: {
  repos: Repositories;
  github: GitHubClient;
  repository: string;
  commitSha: string;
  branch?: string | null;
  defaultBranch?: string;
}): Promise<string> {
  const existing = input.repos.getChangeBySha(input.commitSha);
  if (existing) {
    return existing.id;
  }

  const { owner, name } = parseRepository(input.repository);
  const repositoryId = `repo_${owner}_${name}`;
  input.repos.upsertRepository({
    id: repositoryId,
    provider: "github",
    owner,
    name,
    default_branch: input.defaultBranch ?? "main",
  });

  try {
    const commit = await input.github.getCommit(input.commitSha);
    const parsed = extractAiTraceparentFromMessage(commit.commit.message);
    const changeId = `chg_${input.commitSha.slice(0, 12)}`;
    input.repos.upsertChange({
      id: changeId,
      repository_id: repositoryId,
      commit_sha: input.commitSha,
      short_sha: input.commitSha.slice(0, 7),
      branch: input.branch ?? null,
      commit_subject: commit.commit.message.split("\n")[0] ?? null,
      committed_at: commit.commit.author.date,
      ai_traceparent: parsed?.ok ? `00-${parsed.value.traceId}-${parsed.value.spanId}-${parsed.value.flags}` : null,
      ai_trace_id: parsed?.ok ? parsed.value.traceId : null,
      ai_span_id: parsed?.ok ? parsed.value.spanId : null,
      ai_trace_flags: parsed?.ok ? parsed.value.flags : null,
      ai_link_status: deriveAiLinkStatus(parsed),
      changed_files_count: null,
      additions: null,
      deletions: null,
      changed_paths_json: null,
      created_at: new Date().toISOString(),
    });
    return changeId;
  } catch {
    const changeId = `chg_${input.commitSha.slice(0, 12)}`;
    input.repos.upsertChange({
      id: changeId,
      repository_id: repositoryId,
      commit_sha: input.commitSha,
      short_sha: input.commitSha.slice(0, 7),
      branch: input.branch ?? null,
      commit_subject: `deployment ${input.commitSha.slice(0, 7)}`,
      committed_at: new Date().toISOString(),
      ai_traceparent: null,
      ai_trace_id: null,
      ai_span_id: null,
      ai_trace_flags: null,
      ai_link_status: "missing",
      changed_files_count: null,
      additions: null,
      deletions: null,
      changed_paths_json: null,
      created_at: new Date().toISOString(),
    });
    return changeId;
  }
}

export async function syncWorkflowRuns(
  input: SyncWorkflowRunsInput,
): Promise<SyncedChangeResult[]> {
  const { owner, name } = parseRepository(input.repository);
  const repositoryId = `repo_${owner}_${name}`;
  input.repos.upsertRepository({
    id: repositoryId,
    provider: "github",
    owner,
    name,
    default_branch: input.defaultBranch ?? "main",
  });

  const fetched = await Promise.all(
    input.runIds.map(async (runId) => {
      const run = await input.github.getWorkflowRun(runId);
      const jobs = await input.github.getWorkflowJobs(runId);
      return { run, jobs: jobs.jobs };
    }),
  );

  const grouped = new Map<string, typeof fetched>();
  for (const item of fetched) {
    const group = grouped.get(item.run.head_sha) ?? [];
    group.push(item);
    grouped.set(item.run.head_sha, group);
  }

  const results: SyncedChangeResult[] = [];
  const reconstructionAtMs = input.reconstructionAtMs ?? Date.now();

  for (const [commitSha, runsForCommit] of grouped) {
    const warnings: string[] = [];
    const commit = await input.github.getCommit(commitSha);
    const parsed = extractAiTraceparentFromMessage(commit.commit.message);
    const aiLinkStatus = deriveAiLinkStatus(parsed);
    const changeId = `chg_${commitSha.slice(0, 12)}`;

    input.repos.upsertChange({
      id: changeId,
      repository_id: repositoryId,
      commit_sha: commitSha,
      short_sha: commitSha.slice(0, 7),
      branch: runsForCommit[0]?.run.head_branch ?? null,
      commit_subject: commit.commit.message.split("\n")[0] ?? null,
      committed_at: commit.commit.author.date,
      ai_traceparent: parsed?.ok
        ? `00-${parsed.value.traceId}-${parsed.value.spanId}-${parsed.value.flags}`
        : null,
      ai_trace_id: parsed?.ok ? parsed.value.traceId : null,
      ai_span_id: parsed?.ok ? parsed.value.spanId : null,
      ai_trace_flags: parsed?.ok ? parsed.value.flags : null,
      ai_link_status: aiLinkStatus,
      changed_files_count: null,
      additions: null,
      deletions: null,
      changed_paths_json: null,
      created_at: new Date().toISOString(),
    });

    const normalizedRuns = runsForCommit.map(({ run, jobs }) => ({
      normalized: normalizeWorkflowRun(
        run,
        jobs.map((job) => ({ ...job, steps: job.steps ?? [] })),
      ),
      run,
    }));

    const marked = markPrimaryRuns(
      normalizedRuns.map(({ normalized }) => ({
        providerRunId: normalized.providerRunId,
        workflowName: normalized.workflowName,
        isPrimary: false,
      })),
      input.primaryWorkflowName,
    );
    const primaryRunId = marked.find((run) => run.isPrimary)?.providerRunId;

    input.repos.clearPrimaryForChange(changeId);
    const pipelineRunIds: string[] = [];

    for (const { normalized } of normalizedRuns) {
      const isPrimary = normalized.providerRunId === primaryRunId;
      const existing = input.repos
        .getPipelineRunsForChange(changeId)
        .find((run) => run.provider_run_id === normalized.providerRunId);
      let emittedTraceId = existing?.emitted_trace_id ?? null;

      if (!shouldSkipEmission(emittedTraceId) && isPrimary) {
        const synthesized = await synthesizeCiTrace({
          run: normalized,
          repository: input.repository,
          reconstructionAtMs,
          aiSpanContext: parsed?.ok ? parsed.value : null,
          includeAiLink: shouldAttachAiLink(isPrimary, parsed?.ok ? parsed.value : null),
        });
        emittedTraceId = synthesized.traceId;
      } else if (!isPrimary && parsed?.ok) {
        warnings.push(`Skipped AI link for non-primary workflow ${normalized.workflowName}`);
      }

      const pipelineRunId = `run_${normalized.providerRunId}`;
      input.repos.upsertPipelineRun({
        id: pipelineRunId,
        change_id: changeId,
        provider_run_id: normalized.providerRunId,
        workflow_name: normalized.workflowName,
        status: normalized.status,
        conclusion: normalized.conclusion,
        started_at: normalized.startedAtMs ? new Date(normalized.startedAtMs).toISOString() : null,
        completed_at: normalized.completedAtMs ? new Date(normalized.completedAtMs).toISOString() : null,
        html_url: normalized.htmlUrl,
        is_primary: isPrimary ? 1 : 0,
        emitted_trace_id: emittedTraceId,
        synced_at: new Date().toISOString(),
      });
      pipelineRunIds.push(pipelineRunId);
    }

    results.push({ changeId, commitSha, pipelineRunIds, warnings });
  }

  return results;
}

export async function syncLatestWorkflowRuns(input: {
  repos: Repositories;
  github: GitHubClient;
  repository: string;
  branch: string;
  primaryWorkflowName: string;
  defaultBranch?: string;
}): Promise<SyncedChangeResult[]> {
  const response = await input.github.listWorkflowRuns({
    branch: input.branch,
    status: "completed",
  });
  const primaryRuns = response.workflow_runs.filter(
    (run) => run.name === input.primaryWorkflowName,
  );
  if (primaryRuns.length === 0) {
    throw new Error(`No completed runs found for primary workflow "${input.primaryWorkflowName}"`);
  }

  const latestPrimary = [...primaryRuns].sort(
    (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at),
  )[0];
  const relatedRunIds = response.workflow_runs
    .filter((run) => run.head_sha === latestPrimary.head_sha)
    .map((run) => run.id);

  return syncWorkflowRuns({
    repos: input.repos,
    github: input.github,
    repository: input.repository,
    runIds: relatedRunIds,
    primaryWorkflowName: input.primaryWorkflowName,
    defaultBranch: input.defaultBranch,
  });
}
