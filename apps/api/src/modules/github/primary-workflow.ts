/**
 * Chooses which workflow run is *the* CI result for a commit.
 *
 * A receipt names one primary run, because "did CI approve this commit" has to
 * have a single answer. Every other run for the same commit is still recorded
 * and shown as related context, so this decides what is *reported* as primary;
 * it never discards a run.
 */
export interface WorkflowCandidate {
  providerRunId: string;
  workflowName: string;
  workflowId?: number | null;
  /**
   * When GitHub last updated the run, epoch milliseconds. Orders two runs of
   * the same workflow; a candidate without one simply sorts last.
   */
  updatedAtMs?: number | null;
}

export class PrimaryWorkflowConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrimaryWorkflowConfigurationError";
  }
}

/**
 * Orders runs of one workflow, newest first.
 *
 * `updated_at` is the discriminator rather than a re-run counter: re-running a
 * workflow keeps its run ID, so a re-run arrives as a single candidate rather
 * than two. Two candidates therefore always mean two genuinely distinct runs.
 * The run ID breaks a tie only so that identical timestamps still produce a
 * stable choice instead of one that depends on GitHub's response order.
 */
function newestFirst(left: WorkflowCandidate, right: WorkflowCandidate): number {
  const byRecency = (right.updatedAtMs ?? 0) - (left.updatedAtMs ?? 0);
  if (byRecency !== 0) {
    return byRecency;
  }
  const leftId = Number(left.providerRunId);
  const rightId = Number(right.providerRunId);
  return Number.isFinite(leftId) && Number.isFinite(rightId)
    ? rightId - leftId
    : right.providerRunId.localeCompare(left.providerRunId);
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
  if (matches.length === 1) {
    return matches[0];
  }

  // One workflow routinely produces several runs for a single commit:
  // `on: [push, pull_request]` does it on any branch with an open pull request.
  // Those runs are not ambiguous — they are the same check, and its result is
  // the most recent of them. Refusing to choose rejected the commit outright,
  // and no setting could rescue it, because every run of one workflow shares
  // that workflow's ID.
  const workflowIds = new Set(matches.map((run) => run.workflowId));
  const namesOneWorkflow =
    workflowIds.size === 1 && !workflowIds.has(null) && !workflowIds.has(undefined);
  if (namesOneWorkflow) {
    return [...matches].sort(newestFirst)[0];
  }

  // Distinct — or unknown — workflow IDs mean the configured name does not pick
  // out a single check, and no ordering can fix that: these are different
  // checks that happen to share a name. Naming the workflow by ID does fix it.
  throw new PrimaryWorkflowConfigurationError(
    `Multiple distinct workflows matched ${identity}; ` +
    "set GREENLIGHT_PRIMARY_WORKFLOW_ID to the workflow whose run is this commit's CI result",
  );
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
