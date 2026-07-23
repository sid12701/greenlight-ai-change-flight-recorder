export interface WorkflowCandidate {
  providerRunId: string;
  workflowName: string;
}

export class PrimaryWorkflowConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrimaryWorkflowConfigurationError";
  }
}

export function selectPrimaryWorkflow(
  runs: WorkflowCandidate[],
  primaryWorkflowName: string,
): WorkflowCandidate {
  const matches = runs.filter((run) => run.workflowName === primaryWorkflowName);

  if (matches.length === 0) {
    throw new PrimaryWorkflowConfigurationError(
      `No workflow run matched primary workflow "${primaryWorkflowName}"`,
    );
  }

  if (matches.length > 1) {
    throw new PrimaryWorkflowConfigurationError(
      `Multiple workflow runs matched primary workflow "${primaryWorkflowName}"`,
    );
  }

  return matches[0];
}

export function markPrimaryRuns<T extends WorkflowCandidate & { isPrimary: boolean }>(
  runs: T[],
  primaryWorkflowName: string,
): T[] {
  const primary = selectPrimaryWorkflow(runs, primaryWorkflowName);
  return runs.map((run) => ({
    ...run,
    isPrimary: run.providerRunId === primary.providerRunId,
  }));
}
