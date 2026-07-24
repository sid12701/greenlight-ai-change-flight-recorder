import type { ChangeRow, DeploymentRow, PipelineRunRow, RegressionEvaluationRow } from "../../db/repositories/index.js";
import type { ChangeSummary } from "@greenlight/shared";

export function toChangeSummary(input: {
  change: ChangeRow;
  primary?: PipelineRunRow;
  relatedCount: number;
  deployment?: DeploymentRow;
  evaluation?: RegressionEvaluationRow;
}): ChangeSummary {
  return {
    commitSha: input.change.commit_sha,
    shortSha: input.change.short_sha,
    commitSubject: input.change.commit_subject,
    committedAt: input.change.committed_at,
    aiLinkStatus: input.change.ai_link_status,
    aiVerificationState: input.change.ai_verification_state ?? (
      input.change.ai_link_status === "linked"
        ? "unverified"
        : input.change.ai_link_status
    ),
    primaryWorkflowName: input.primary?.workflow_name ?? null,
    primaryWorkflowConclusion: input.primary?.conclusion ?? null,
    deploymentStatus: input.deployment?.status ?? null,
    regressionStatus: input.evaluation?.status ?? null,
    relatedPipelineCount: input.relatedCount,
  };
}

export function listChangeSummaries(
  changes: ChangeRow[],
  pipelinesByChange: Map<string, PipelineRunRow[]>,
  deploymentsByChange: Map<string, DeploymentRow[]>,
  evaluationsByDeployment: Map<string, RegressionEvaluationRow>,
): ChangeSummary[] {
  return changes.map((change) => {
    const pipelines = pipelinesByChange.get(change.id) ?? [];
    const primary = pipelines.find((run) => run.is_primary === 1);
    const deployment = deploymentsByChange.get(change.id)?.[0];
    const evaluation = deployment
      ? evaluationsByDeployment.get(deployment.id)
      : undefined;
    return toChangeSummary({
      change,
      primary,
      relatedCount: pipelines.filter((run) => run.is_primary !== 1).length,
      deployment,
      evaluation,
    });
  });
}
