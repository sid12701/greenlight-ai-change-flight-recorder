import {
  extractAiTraceparentFromMessage,
  formatTraceparent,
  type ChangeReceipt,
} from "@greenlight/shared";
import type {
  ChangeRow,
  DeploymentRow,
  PipelineRunRow,
  RegressionEvaluationRow,
  Repositories,
} from "../../db/repositories/index.js";
import { findSlowestStep, normalizeWorkflowRun } from "../github/normalize.js";
import { buildSignozTraceUrl } from "../ci-telemetry/link.js";
import { DEFAULT_THRESHOLDS } from "../regressions/evaluator.js";

export function assembleReceipt(input: {
  change: ChangeRow;
  repository: string;
  pipelines: PipelineRunRow[];
  deployments: DeploymentRow[];
  evaluation?: RegressionEvaluationRow;
  recoveryEvaluation?: RegressionEvaluationRow;
  recoveryDeployment?: DeploymentRow;
  signozUrl: string;
  normalizedRun?: ReturnType<typeof normalizeWorkflowRun>;
  evidenceLinks?: Array<{ kind: "signoz_trace" | "signoz_dashboard"; label: string; url: string }>;
}): ChangeReceipt {
  const primary = input.pipelines.find((run) => run.is_primary === 1);
  const related = input.pipelines.filter((run) => run.is_primary !== 1);
  const latestDeployment =
    input.deployments.find((deployment) => deployment.role !== "baseline") ??
    input.deployments[0];

  const aiParsed = input.change.ai_traceparent
    ? extractAiTraceparentFromMessage(`AI-Traceparent: ${input.change.ai_traceparent}`)
    : null;

  const slowestStep = input.normalizedRun ? findSlowestStep(input.normalizedRun) : null;

  return {
    change: {
      commitSha: input.change.commit_sha,
      shortSha: input.change.short_sha,
      commitSubject: input.change.commit_subject,
      committedAt: input.change.committed_at,
      branch: input.change.branch,
      aiLinkStatus: input.change.ai_link_status,
      aiTraceparent: input.change.ai_traceparent,
      aiSpanContext: aiParsed?.ok ? aiParsed.value : null,
      githubUrl: `https://github.com/${input.repository}/commit/${input.change.commit_sha}`,
      changedFilesCount: input.change.changed_files_count,
      additions: input.change.additions,
      deletions: input.change.deletions,
    },
    pipeline: primary
      ? {
          workflowName: primary.workflow_name,
          status: primary.status,
          conclusion: primary.conclusion,
          durationMs: input.normalizedRun?.durationMs ?? null,
          slowestStep: slowestStep?.name ?? null,
          htmlUrl: primary.html_url,
          signozTraceUrl: primary.emitted_trace_id
            ? buildSignozTraceUrl(input.signozUrl, primary.emitted_trace_id)
            : null,
          isReconstructed: true,
        }
      : null,
    relatedPipelines: related.map((run) => ({
      workflowName: run.workflow_name,
      status: run.status,
      conclusion: run.conclusion,
      htmlUrl: run.html_url,
    })),
    deployment: latestDeployment
      ? {
          id: latestDeployment.id,
          serviceName: latestDeployment.service_name,
          environmentName: latestDeployment.environment_name,
          version: input.change.commit_sha,
          role: latestDeployment.role,
          status: latestDeployment.status,
          deployedAt: latestDeployment.deployed_at,
        }
      : null,
    impact: input.evaluation
      ? {
          route: input.evaluation.route,
          baselineVersion: input.evaluation.baseline_service_version,
          observedVersion: input.evaluation.observed_service_version,
          baselineRequestCount: input.evaluation.baseline_request_count,
          observedRequestCount: input.evaluation.observed_request_count,
          baselineP95Ms: input.evaluation.baseline_p95_ms,
          observedP95Ms: input.evaluation.observed_p95_ms,
          baselineP90Ms: input.evaluation.baseline_p95_ms,
          observedP90Ms: input.evaluation.observed_p95_ms,
          baselineErrorRate: input.evaluation.baseline_error_rate,
          observedErrorRate: input.evaluation.observed_error_rate,
          status: input.evaluation.status,
          reasons: JSON.parse(input.evaluation.reasons_json),
          thresholds: {
            latencyMultiplier: DEFAULT_THRESHOLDS.latencyMultiplier,
            latencyAdditiveMs: DEFAULT_THRESHOLDS.latencyAdditiveMs,
            errorRateDeltaPct: DEFAULT_THRESHOLDS.errorRateDeltaPct,
            errorRateAbsolutePct: DEFAULT_THRESHOLDS.errorRateAbsolutePct,
            minSpans: DEFAULT_THRESHOLDS.minSpans,
          },
          correlationNote:
            "Deployment correlation is evidence of temporal and version association, not proof that every observed failure was caused by the commit.",
        }
      : null,
    evidence: input.evidenceLinks?.length
      ? input.evidenceLinks.map((link) => ({
          kind: link.kind,
          label: link.label,
          url: link.url,
        }))
      : input.evaluation?.signoz_dashboard_url
        ? [
            {
              kind: "signoz_dashboard" as const,
              label: "Deployment Impact dashboard",
              url: input.evaluation.signoz_dashboard_url,
            },
          ]
        : [],
    recovery: input.recoveryDeployment
      ? {
          deploymentId: input.recoveryDeployment.id,
          version: input.change.commit_sha,
          deployedAt: input.recoveryDeployment.deployed_at,
          status: input.recoveryEvaluation?.status ?? null,
          observedP95Ms: input.recoveryEvaluation?.observed_p95_ms ?? null,
          observedErrorRate: input.recoveryEvaluation?.observed_error_rate ?? null,
        }
      : null,
    actions: {
      revertCommand: `git revert ${input.change.commit_sha}`,
    },
    caveat:
      "Deployment correlation is evidence of temporal and version association, not proof that every observed failure was caused by the commit.",
  };
}

export function getReceipt(
  repos: Repositories,
  repository: string,
  signozUrl: string,
  commitSha: string,
): ChangeReceipt | null {
  const change = repos.getChangeBySha(commitSha);
  if (!change) {
    return null;
  }
  const pipelines = repos.getPipelineRunsForChange(change.id);
  const deployments = repos.getDeploymentsForChange(change.id);
  const candidateDeployment = deployments.find((deployment) => deployment.role !== "baseline");
  const evaluation = candidateDeployment
    ? repos.getLatestEvaluationForDeployment(candidateDeployment.id)
    : undefined;
  const recoveryDeployment = deployments.find((deployment) => deployment.role === "recovery");
  const recoveryEvaluation = recoveryDeployment
    ? repos.getLatestEvaluationForDeployment(recoveryDeployment.id)
    : undefined;
  const evidenceLinks = evaluation
    ? repos.getEvidenceLinksForEvaluation(evaluation.id).map((link) => ({
        kind: link.kind,
        label: link.label,
        url: link.url,
      }))
    : [];

  return assembleReceipt({
    change,
    repository,
    pipelines,
    deployments,
    evaluation,
    recoveryDeployment,
    recoveryEvaluation,
    signozUrl,
    evidenceLinks,
  });
}

export function formatAiTrailer(change: ChangeRow) {
  if (!change.ai_traceparent) {
    return null;
  }
  return formatTraceparent({
    version: "00",
    traceId: change.ai_trace_id ?? "",
    spanId: change.ai_span_id ?? "",
    flags: change.ai_trace_flags ?? "01",
  });
}
