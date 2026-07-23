import type { DeploymentRow, RegressionEvaluationRow } from "../../db/repositories/index.js";

export class BaselineRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaselineRequiredError";
  }
}

export function resolveBaselineDeployment(
  deployments: DeploymentRow[],
  serviceName: string,
  environmentName: string,
  explicitBaselineId?: string,
): DeploymentRow {
  const baselineCandidates = deployments.filter(
    (deployment) =>
      deployment.service_name === serviceName &&
      deployment.environment_name === environmentName &&
      deployment.role === "baseline" &&
      deployment.status === "succeeded",
  );

  if (explicitBaselineId) {
    const explicit = baselineCandidates.find((deployment) => deployment.id === explicitBaselineId);
    if (!explicit) {
      throw new BaselineRequiredError("Explicit baseline deployment is invalid");
    }
    return explicit;
  }

  if (baselineCandidates.length !== 1) {
    throw new BaselineRequiredError("Exactly one frozen baseline deployment is required");
  }

  return baselineCandidates[0];
}

export function resolveRecoveryBaseline(
  evaluations: RegressionEvaluationRow[],
  _serviceName: string,
  _environmentName: string,
  route: string,
): RegressionEvaluationRow | undefined {
  return evaluations
    .filter(
      (evaluation) =>
        evaluation.route === route &&
        evaluation.status === "regressed",
    )
    .sort((a, b) => Date.parse(b.evaluated_at) - Date.parse(a.evaluated_at))[0];
}

export function validateBaselineOrdering(
  baseline: DeploymentRow,
  observed: DeploymentRow,
) {
  if (baseline.service_name !== observed.service_name || baseline.environment_name !== observed.environment_name) {
    throw new BaselineRequiredError("Baseline and observed deployments must share service/environment");
  }
  if (Date.parse(baseline.deployed_at) >= Date.parse(observed.deployed_at)) {
    throw new BaselineRequiredError("Baseline deployment must precede observed deployment");
  }
}
