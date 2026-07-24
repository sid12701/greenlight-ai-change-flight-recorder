import type { DeploymentRow } from "../../db/repositories/index.js";

export class BaselineRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaselineRequiredError";
  }
}

/**
 * Selects the frozen baseline from the candidates for one service and
 * environment.
 *
 * Callers pass an already-scoped list (see
 * `Repositories.listBaselineDeployments`) so the scoping rule lives in one
 * place — SQL — rather than being re-implemented per call site.
 *
 * Ambiguity is an error: an evidence product must not guess which baseline a
 * verdict was measured against.
 */
export function resolveBaselineDeployment(
  scopedBaselines: DeploymentRow[],
  explicitBaselineId?: string,
): DeploymentRow {
  if (explicitBaselineId) {
    const explicit = scopedBaselines.find((deployment) => deployment.id === explicitBaselineId);
    if (!explicit) {
      throw new BaselineRequiredError(
        "The requested baseline deployment does not exist for this service and environment",
      );
    }
    return explicit;
  }

  if (scopedBaselines.length === 0) {
    throw new BaselineRequiredError(
      "No frozen baseline deployment exists for this service and environment",
    );
  }
  if (scopedBaselines.length > 1) {
    throw new BaselineRequiredError(
      "Multiple baseline deployments exist for this service and environment; specify baselineDeploymentId",
    );
  }
  return scopedBaselines[0];
}

export function validateBaselineOrdering(baseline: DeploymentRow, observed: DeploymentRow) {
  if (
    baseline.service_name !== observed.service_name ||
    baseline.environment_name !== observed.environment_name
  ) {
    throw new BaselineRequiredError(
      "Baseline and observed deployments must share service and environment",
    );
  }
  if (Date.parse(baseline.deployed_at) >= Date.parse(observed.deployed_at)) {
    throw new BaselineRequiredError("Baseline deployment must precede observed deployment");
  }
}
