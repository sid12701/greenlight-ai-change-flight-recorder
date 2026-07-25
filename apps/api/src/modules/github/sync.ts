import {
  extractAiTraceparentFromMessage,
  type AiLinkStatus,
} from "@greenlight/shared";
import type { Repositories } from "../../db/repositories/index.js";
import { synthesizeCiTrace } from "../ci-telemetry/synthesizer.js";
import { shouldAttachAiLink } from "../ci-telemetry/link.js";
import type { GitHubClient } from "./client.js";
import { DependencyError } from "../../http/errors.js";
import { recordAiVerificationState } from "../../observability/metrics.js";
import { markPrimaryRuns } from "./primary-workflow.js";
import { findSlowestStep, normalizeWorkflowRun } from "./normalize.js";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { SpanContext } from "@greenlight/shared";

export interface SyncWorkflowRunsInput {
  repos: Repositories;
  github: GitHubClient;
  repository: string;
  runIds: number[];
  primaryWorkflowName: string;
  primaryWorkflowId?: number;
  defaultBranch?: string;
  reconstructionAtMs?: number;
  exporterFactory?: () => SpanExporter;
  verifyExport?: (
    traceId: string,
    expectedSpanCount: number,
    startMs: number,
    endMs: number,
  ) => Promise<boolean>;
  verifyAiSpan?: (context: SpanContext, committedAt: string | null) => Promise<boolean>;
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

type ParsedAiTraceparent = ReturnType<typeof extractAiTraceparentFromMessage>;

/**
 * A commit that carries no trailer is not the same as one whose trailer is
 * malformed, but the parser reports both as a failed parse, so the two are
 * separated by error code here.
 *
 * The distinction is load-bearing: describing an absent trailer as invalid
 * tells a reader the commit tried to record an AI session and got it wrong,
 * which is a claim the receipt has no evidence for.
 */
function isMissingTrailer(parsed: ParsedAiTraceparent): boolean {
  return !parsed.ok && parsed.code === "missing_trailer";
}

function deriveAiLinkStatus(parsed: ParsedAiTraceparent): AiLinkStatus {
  if (parsed.ok) {
    return "linked";
  }
  return isMissingTrailer(parsed) ? "missing" : "invalid";
}

function deriveAiVerificationState(parsed: ParsedAiTraceparent, aiVerified: boolean) {
  const state = parsed.ok
    ? aiVerified ? "verified" : "unverified"
    : isMissingTrailer(parsed) ? "missing" : "invalid";
  recordAiVerificationState(state);
  return state;
}

export async function ensureChangeFromCommit(input: {
  repos: Repositories;
  github: GitHubClient;
  repository: string;
  commitSha: string;
  branch?: string | null;
  defaultBranch?: string;
}): Promise<string> {
  const existing = await input.repos.getChangeBySha(input.commitSha);
  if (existing) {
    return existing.id;
  }

  const { owner, name } = parseRepository(input.repository);
  const repositoryId = `repo_${owner}_${name}`;
  await input.repos.upsertRepository({
    id: repositoryId,
    provider: "github",
    owner,
    name,
    default_branch: input.defaultBranch ?? "main",
  });

  let commit;
  try {
    commit = await input.github.getCommit(input.commitSha);
  } catch (error) {
    throw new DependencyError(
      "github_commit_unavailable",
      error instanceof Error ? error.message : "GitHub commit lookup failed",
    );
  }
  const parsed = extractAiTraceparentFromMessage(commit.commit.message);
  const changeId = `chg_${input.commitSha.slice(0, 12)}`;
  await input.repos.upsertChange({
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
    ai_verification_state: deriveAiVerificationState(parsed, false),
    changed_files_count: null,
    additions: null,
    deletions: null,
    changed_paths_json: null,
    created_at: new Date().toISOString(),
  });
  return changeId;
}

export async function syncWorkflowRuns(
  input: SyncWorkflowRunsInput,
): Promise<SyncedChangeResult[]> {
  const { owner, name } = parseRepository(input.repository);
  const repositoryId = `repo_${owner}_${name}`;
  await input.repos.upsertRepository({
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
    const aiVerified = parsed?.ok && input.verifyAiSpan
      ? await input.verifyAiSpan(parsed.value, commit.commit.author.date)
      : false;
    const changeId = `chg_${commitSha.slice(0, 12)}`;

    const changeRow = {
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
      ai_verification_state: deriveAiVerificationState(parsed, Boolean(aiVerified)),
      ai_verified_at: aiVerified ? new Date().toISOString() : null,
      ai_verification_error: parsed?.ok && !aiVerified
        ? "Exact Claude trace/span was not verified in SigNoz"
        : null,
      changed_files_count: null,
      additions: null,
      deletions: null,
      changed_paths_json: null,
      created_at: new Date().toISOString(),
    } as const;

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
        workflowId: normalized.workflowId,
        isPrimary: false,
      })),
      input.primaryWorkflowName,
      input.primaryWorkflowId,
    );
    const primaryRunId = marked.find((run) => run.isPrimary)?.providerRunId;

    const pipelineRunIds: string[] = [];
    const pipelineRows: Parameters<Repositories["upsertPipelineRun"]>[0][] = [];

    const existingRuns = new Map(
      (await input.repos.getPipelineRunsForChange(changeId))
        .map((run) => [run.provider_run_id, run] as const),
    );

    for (const { normalized } of normalizedRuns) {
      const isPrimary = normalized.providerRunId === primaryRunId;
      const existing = existingRuns.get(normalized.providerRunId);

      // The trace ID and the state describing it are always written together.
      // Carrying a trace ID forward from an earlier attempt while adopting a
      // later attempt's state would publish an unverified trace as verified.
      let attempt: ExportAttempt = existing?.export_state === "verified" &&
        existing.emitted_trace_id
        ? {
          traceId: existing.emitted_trace_id,
          state: "verified",
          error: null,
          verifiedAt: existing.verified_at ?? null,
        }
        : { traceId: null, state: "pending", error: null, verifiedAt: null };

      if (attempt.state !== "verified") {
        attempt = await exportAndVerifyRun({
          normalized,
          repository: input.repository,
          reconstructionAtMs,
          aiSpanContext: parsed?.ok ? parsed.value : null,
          includeAiLink: shouldAttachAiLink(isPrimary, parsed?.ok ? parsed.value : null),
          exporterFactory: input.exporterFactory,
          verifyExport: input.verifyExport,
        });
      }

      const { traceId: emittedTraceId, state: exportState, error: exportError, verifiedAt } =
        attempt;

      if (!isPrimary && parsed?.ok) {
        warnings.push(`Skipped AI link for non-primary workflow ${normalized.workflowName}`);
      }

      const pipelineRunId = `run_${normalized.providerRunId}`;
      const slowestStep = findSlowestStep(normalized);
      pipelineRows.push({
        id: pipelineRunId,
        change_id: changeId,
        provider_run_id: normalized.providerRunId,
        workflow_name: normalized.workflowName,
        status: normalized.status,
        conclusion: normalized.conclusion,
        started_at: normalized.startedAtMs ? new Date(normalized.startedAtMs).toISOString() : null,
        completed_at: normalized.completedAtMs ? new Date(normalized.completedAtMs).toISOString() : null,
        duration_ms: normalized.durationMs,
        slowest_step: slowestStep?.name ?? null,
        html_url: normalized.htmlUrl,
        is_primary: isPrimary ? 1 : 0,
        emitted_trace_id: emittedTraceId,
        export_state: exportState,
        export_error: exportError,
        verified_at: verifiedAt,
        synced_at: new Date().toISOString(),
      });
      pipelineRunIds.push(pipelineRunId);
    }

    await input.repos.transaction(async (tx) => {
      await tx.upsertChange(changeRow);
      await tx.clearPrimaryForChange(changeId);
      for (const row of pipelineRows) {
        await tx.upsertPipelineRun(row);
      }
    });

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
  primaryWorkflowId?: number;
  defaultBranch?: string;
  exporterFactory?: () => SpanExporter;
  verifyExport?: SyncWorkflowRunsInput["verifyExport"];
  verifyAiSpan?: SyncWorkflowRunsInput["verifyAiSpan"];
}): Promise<SyncedChangeResult[]> {
  const response = await input.github.listWorkflowRuns({
    branch: input.branch,
    status: "completed",
  });
  const primaryRuns = response.workflow_runs.filter((run) =>
    input.primaryWorkflowId
      ? run.workflow_id === input.primaryWorkflowId
      : run.name === input.primaryWorkflowName,
  );
  if (primaryRuns.length === 0) {
    throw new Error("No completed runs found for the configured primary workflow");
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
    primaryWorkflowId: input.primaryWorkflowId,
    defaultBranch: input.defaultBranch,
    exporterFactory: input.exporterFactory,
    verifyExport: input.verifyExport,
    verifyAiSpan: input.verifyAiSpan,
  });
}

/**
 * One export attempt for one workflow run.
 *
 * Grouping the four fields keeps them inseparable: a caller cannot persist a
 * state from this attempt alongside a trace ID from a previous one.
 */
interface ExportAttempt {
  traceId: string | null;
  state: "pending" | "exported" | "verified" | "failed";
  error: string | null;
  verifiedAt: string | null;
}

async function exportAndVerifyRun(input: {
  normalized: ReturnType<typeof normalizeWorkflowRun>;
  repository: string;
  reconstructionAtMs: number;
  aiSpanContext: SpanContext | null;
  includeAiLink: boolean;
  exporterFactory?: () => SpanExporter;
  verifyExport?: SyncWorkflowRunsInput["verifyExport"];
}): Promise<ExportAttempt> {
  try {
    const synthesized = await synthesizeCiTrace(
      {
        run: input.normalized,
        repository: input.repository,
        reconstructionAtMs: input.reconstructionAtMs,
        aiSpanContext: input.aiSpanContext,
        includeAiLink: input.includeAiLink,
      },
      input.exporterFactory?.(),
    );
    if (!input.verifyExport) {
      return { traceId: synthesized.traceId, state: "exported", error: null, verifiedAt: null };
    }
    const verified = await input.verifyExport(
      synthesized.traceId,
      synthesized.spanCount,
      input.normalized.startedAtMs ?? input.reconstructionAtMs,
      input.normalized.completedAtMs ?? input.reconstructionAtMs,
    );
    return verified
      ? {
        traceId: synthesized.traceId,
        state: "verified",
        error: null,
        verifiedAt: new Date().toISOString(),
      }
      : {
        traceId: synthesized.traceId,
        state: "failed",
        error: "Reconstructed trace tree was not visible in SigNoz",
        verifiedAt: null,
      };
  } catch (error) {
    return {
      traceId: null,
      state: "failed",
      error: error instanceof Error ? error.message : "CI trace export failed",
      verifiedAt: null,
    };
  }
}
