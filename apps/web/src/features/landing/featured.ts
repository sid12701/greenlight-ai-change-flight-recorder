import type { ChangeSummary } from "@greenlight/shared";

/**
 * How complete a change's evidence chain is, from a judge's point of view.
 *
 * `complete` means every link a receipt claims to connect actually exists:
 * an AI session verified in SigNoz, a CI conclusion, a deployment, and a
 * regression verdict reached from real telemetry. Anything less is partial and
 * must not be presented as the demo's proof.
 */
export type ChainCompleteness = "complete" | "partial" | "none";

const DECIDED_REGRESSION_STATUSES = new Set(["healthy", "regressed", "recovered"]);

export function chainCompleteness(change: ChangeSummary): ChainCompleteness {
  const hasVerdict = change.regressionStatus !== null &&
    DECIDED_REGRESSION_STATUSES.has(change.regressionStatus);
  const links = [
    change.aiVerificationState === "verified",
    change.primaryWorkflowConclusion !== null,
    change.deploymentStatus !== null,
    hasVerdict,
  ];
  const present = links.filter(Boolean).length;
  if (present === links.length) {
    return "complete";
  }
  return present === 0 ? "none" : "partial";
}

/**
 * Picks the change the landing page offers as the demo receipt.
 *
 * A regression that was recovered tells the whole story in one receipt, so it
 * outranks a change that merely stayed healthy. Only complete chains are
 * eligible: offering a partial chain as "the verified demo" would be the same
 * overclaiming the receipt itself is careful to avoid.
 */
export function selectFeaturedChange(changes: ChangeSummary[]): ChangeSummary | null {
  const complete = changes.filter((change) => chainCompleteness(change) === "complete");
  if (complete.length === 0) {
    return null;
  }
  const recovered = complete.find((change) => change.regressionStatus === "recovered");
  return recovered ?? complete[0];
}
