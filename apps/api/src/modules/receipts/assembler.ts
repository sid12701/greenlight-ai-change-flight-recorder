import {
  extractAiTraceparentFromMessage,
  type ChangeReceipt,
} from "@greenlight/shared";
import type {
  ChangeRow,
  DeploymentRow,
  PipelineRunRow,
  RegressionEvaluationRow,
  Repositories,
} from "../../db/repositories/index.js";
import { findSlowestStep, type normalizeWorkflowRun } from "../github/normalize.js";
import { buildSignozTraceUrl } from "../ci-telemetry/link.js";
import { z } from "zod";
import {
  thresholdsForPolicyVersion,
  type RegressionThresholds,
} from "../regressions/evaluator.js";

const RegressionThresholdsSchema = z.object({
  latencyMultiplier: z.number(),
  latencyAdditiveMs: z.number(),
  errorRateDeltaPct: z.number(),
  errorRateAbsolutePct: z.number(),
  minSpans: z.number(),
  recoveryLatencyMultiplier: z.number(),
  recoveryErrorRateDeltaPct: z.number(),
});

/**
 * Returns the threshold set the evaluation was actually decided with.
 *
 * The stored values win, because they are the only record of what the verdict
 * was measured against. When they are absent or unreadable the evaluation's own
 * policy version is resolved instead — never the current defaults, which would
 * present today's configuration as the policy a past verdict was decided under.
 */
function thresholdsFor(evaluation: RegressionEvaluationRow): RegressionThresholds {
  const recordedPolicy = thresholdsForPolicyVersion(evaluation.policy_version);
  if (!evaluation.thresholds_json) {
    return recordedPolicy;
  }
  const parsed = RegressionThresholdsSchema.safeParse(
    JSON.parse(evaluation.thresholds_json) as unknown,
  );
  return parsed.success ? parsed.data : recordedPolicy;
}

export function assembleReceipt(input: {
  change: ChangeRow;
  repository: string;
  pipelines: PipelineRunRow[];
  deployments: DeploymentRow[];
  evaluation?: RegressionEvaluationRow;
  recoveryEvaluation?: RegressionEvaluationRow;
  recoveryDeployment?: DeploymentRow;
  deploymentVersion?: string | null;
  recoveryVersion?: string | null;
  signozUrl: string;
  normalizedRun?: ReturnType<typeof normalizeWorkflowRun>;
  evidenceLinks?: Array<{
    kind: "signoz_trace" | "signoz_dashboard" | "github_run" | "deployment_trace" | "ai_trace";
    label: string;
    url: string;
    verification_state?: "pending" | "verified" | "failed";
  }>;
}): ChangeReceipt {
  const primary = input.pipelines.find((run) => run.is_primary === 1);
  const related = input.pipelines.filter((run) => run.is_primary !== 1);
  // The receipt describes the change's candidate deployment. When there is no
  // candidate yet, the most recent deployment is shown with its own role so a
  // baseline or recovery is never mistaken for the candidate.
  const candidateDeployment =
    input.deployments.find((deployment) => deployment.role === "candidate");
  const latestDeployment = candidateDeployment ?? input.deployments[0];

  const aiParsed = input.change.ai_traceparent
    ? extractAiTraceparentFromMessage(`AI-Traceparent: ${input.change.ai_traceparent}`)
    : null;
  const normalizedSlowestStep = input.normalizedRun
    ? findSlowestStep(input.normalizedRun)?.name ?? null
    : null;

  return {
    change: {
      commitSha: input.change.commit_sha,
      shortSha: input.change.short_sha,
      commitSubject: input.change.commit_subject,
      committedAt: input.change.committed_at,
      branch: input.change.branch,
      aiLinkStatus: input.change.ai_link_status,
      aiVerificationState: input.change.ai_verification_state ?? (
        input.change.ai_link_status === "linked"
          ? "unverified"
          : input.change.ai_link_status
      ),
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
          durationMs: primary.duration_ms ?? input.normalizedRun?.durationMs ?? null,
          slowestStep: primary.slowest_step ?? normalizedSlowestStep,
          htmlUrl: primary.html_url,
          signozTraceUrl: primary.emitted_trace_id && primary.export_state === "verified"
            ? buildSignozTraceUrl(input.signozUrl, primary.emitted_trace_id)
            : null,
          exportState: primary.export_state ?? "pending",
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
          version: input.deploymentVersion ?? null,
          role: latestDeployment.role,
          status: latestDeployment.status,
          deployedAt: latestDeployment.deployed_at,
          imageDigest: latestDeployment.image_digest ?? null,
          versionState: latestDeployment.version_state ?? "pending",
          traceState: latestDeployment.trace_state ?? "pending",
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
          baselineP90Ms: input.evaluation.baseline_p90_ms ?? null,
          observedP90Ms: input.evaluation.observed_p90_ms ?? null,
          baselineErrorRate: input.evaluation.baseline_error_rate,
          observedErrorRate: input.evaluation.observed_error_rate,
          status: input.evaluation.status,
          reasons: JSON.parse(input.evaluation.reasons_json),
          thresholds: thresholdsFor(input.evaluation),
          correlationNote:
            "Deployment correlation is evidence of temporal and version association, not proof that every observed failure was caused by the commit.",
          baselineWindow: {
            start: input.evaluation.baseline_start,
            end: input.evaluation.baseline_end,
          },
          observedWindow: {
            start: input.evaluation.observed_start,
            end: input.evaluation.observed_end,
          },
          policyVersion: input.evaluation.policy_version ?? "v1",
        }
      : null,
    evidence: input.evidenceLinks?.length
      ? input.evidenceLinks.map((link) => ({
          kind: link.kind,
          label: link.label,
          url: link.url,
          verificationState: link.verification_state ?? "pending",
        }))
      : input.evaluation?.signoz_dashboard_url
        ? [
            {
              kind: "signoz_dashboard" as const,
              label: "Deployment Impact dashboard",
              url: input.evaluation.signoz_dashboard_url,
              verificationState: "pending" as const,
            },
          ]
        : [],
    recovery: input.recoveryDeployment
      ? {
          deploymentId: input.recoveryDeployment.id,
          version: input.recoveryVersion ?? null,
          deployedAt: input.recoveryDeployment.deployed_at,
          status: input.recoveryEvaluation?.status ?? null,
          observedP95Ms: input.recoveryEvaluation?.observed_p95_ms ?? null,
          observedErrorRate: input.recoveryEvaluation?.observed_error_rate ?? null,
          imageDigest: input.recoveryDeployment.image_digest ?? null,
        }
      : null,
    actions: {
      revertCommand: `git revert ${input.change.commit_sha}`,
    },
    caveat:
      "Deployment correlation is evidence of temporal and version association, not proof that every observed failure was caused by the commit.",
  };
}

export async function getReceipt(
  repos: Repositories,
  repository: string,
  signozUrl: string,
  commitSha: string,
): Promise<ChangeReceipt | null> {
  const change = await repos.getChangeBySha(commitSha);
  if (!change) {
    return null;
  }
  const [pipelines, deployments] = await Promise.all([
    repos.getPipelineRunsForChange(change.id),
    repos.getDeploymentsForChange(change.id),
  ]);
  const candidateDeployment = deployments.find((deployment) => deployment.role === "candidate");
  const evaluation = candidateDeployment
    ? await repos.getLatestEvaluationForDeployment(candidateDeployment.id)
    : undefined;
  const incident = candidateDeployment
    ? await repos.getIncidentForCandidate(candidateDeployment.id, evaluation?.route)
    : undefined;
  const recoveryDeployment = incident?.recovery_deployment_id
    ? await repos.getDeploymentById(incident.recovery_deployment_id)
    : undefined;
  const recoveryEvaluation = recoveryDeployment
    ? await repos.getLatestEvaluationForDeployment(recoveryDeployment.id)
    : undefined;
  const primaryPipeline = pipelines.find((pipeline) => pipeline.is_primary === 1);
  const persistedEvaluationEvidence = evaluation
    ? (await repos.getEvidenceLinksForEvaluation(evaluation.id)).map((link) => ({
        kind: link.kind,
        label: link.label,
        url: link.url,
        verification_state: link.verification_state,
      }))
    : [];
  const evidenceLinks: NonNullable<Parameters<typeof assembleReceipt>[0]["evidenceLinks"]> = [
    ...(change.ai_verification_state === "verified" && change.ai_trace_id && change.ai_span_id
      ? [{
        kind: "ai_trace" as const,
        label: "Verified Claude parent span",
        url: buildSignozTraceUrl(signozUrl, change.ai_trace_id, change.ai_span_id),
        verification_state: "verified" as const,
      }]
      : []),
    ...(primaryPipeline
      ? [{
        kind: "github_run" as const,
        label: "Primary GitHub Actions run",
        url: primaryPipeline.html_url,
        // Synchronised directly from the GitHub API response, so the run is
        // known to exist; GreenLight does not re-resolve the HTML page.
        verification_state: "verified" as const,
      }]
      : []),
    ...(primaryPipeline?.export_state === "verified" && primaryPipeline.emitted_trace_id
      ? [{
        kind: "signoz_trace" as const,
        label: "Verified reconstructed CI trace",
        url: buildSignozTraceUrl(signozUrl, primaryPipeline.emitted_trace_id),
        verification_state: "verified" as const,
      }]
      : []),
    ...(candidateDeployment?.trace_state === "verified" && candidateDeployment.emitted_trace_id
      ? [{
        kind: "deployment_trace" as const,
        label: "Verified deployment marker trace",
        url: buildSignozTraceUrl(signozUrl, candidateDeployment.emitted_trace_id),
        verification_state: "verified" as const,
      }]
      : []),
    ...persistedEvaluationEvidence,
  ];
  // Every deployment here was selected by this change's id, so the version it
  // deployed is this commit. The recovery deployment belongs to a different
  // change, so that one is still resolved.
  const deploymentVersion = (candidateDeployment ?? deployments[0])
    ? change.commit_sha
    : null;
  const recoveryVersion = recoveryDeployment
    ? (await repos.getChangeForDeployment(recoveryDeployment.id))?.commit_sha
    : null;

  return assembleReceipt({
    change,
    repository,
    pipelines,
    deployments,
    evaluation,
    recoveryDeployment,
    recoveryEvaluation,
    deploymentVersion,
    recoveryVersion,
    signozUrl,
    evidenceLinks,
  });
}
