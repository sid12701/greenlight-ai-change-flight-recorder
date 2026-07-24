export interface WorkflowCandidate {
  providerRunId: string;
  workflowName: string;
  workflowId?: number | null;
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
  primaryWorkflowId?: number,
): WorkflowCandidate {
  const matches = runs.filter((run) =>
    primaryWorkflowId
      ? run.workflowId === primaryWorkflowId
      : run.workflowName === primaryWorkflowName,
  );
  const identity = primaryWorkflowId
    ? `workflow ID ${primaryWorkflowId}`
    : `primary workflow "${primaryWorkflowName}"`;

  if (matches.length === 0) {
    throw new PrimaryWorkflowConfigurationError(
      `No workflow run matched ${identity}`,
    );
  }

  if (matches.length > 1) {
    throw new PrimaryWorkflowConfigurationError(
      `Multiple workflow runs matched ${identity}`,
    );
  }

  return matches[0];
}

export function markPrimaryRuns<T extends WorkflowCandidate & { isPrimary: boolean }>(
  runs: T[],
  primaryWorkflowName: string,
  primaryWorkflowId?: number,
): T[] {
  const primary = selectPrimaryWorkflow(runs, primaryWorkflowName, primaryWorkflowId);
  return runs.map((run) => ({
    ...run,
    isPrimary: run.providerRunId === primary.providerRunId,
  }));
}
