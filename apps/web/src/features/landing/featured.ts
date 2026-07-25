import type { ChangeSummary } from "@greenlight/shared";

/**
 * How complete a change's evidence chain is, from a judge's point of view.
 *
 * `complete` means every link a receipt claims to connect actually exists:
 * an AI session verified in SigNoz, a CI conclusion, a deployment, and a
 * regression verdict reached from real telemetry. Anything less is partial.
 *
 * Completeness describes the chain; it does not decide whether the receipt is
 * worth opening. A chain missing only its AI session still carries a verdict
 * measured from production telemetry, and hiding that would tell a reader the
 * product found nothing when it found something.
 */
export type ChainCompleteness = "complete" | "partial" | "none";

const DECIDED_REGRESSION_STATUSES = new Set(["healthy", "regressed", "recovered"]);

/** Whether a change reached a verdict from telemetry rather than failing to. */
function hasDecidedVerdict(change: ChangeSummary): boolean {
  return change.regressionStatus !== null &&
    DECIDED_REGRESSION_STATUSES.has(change.regressionStatus);
}

export function chainCompleteness(change: ChangeSummary): ChainCompleteness {
  const present = evidenceLinks(change).filter((link) => link.resolved).length;
  if (present === 4) {
    return "complete";
  }
  return present === 0 ? "none" : "partial";
}

/**
 * One link in the chain, and whether it resolved.
 *
 * The landing page renders these individually rather than collapsing them to a
 * single pass/fail, because "three of four links resolve and here is which one
 * did not" is the honest summary. Collapsing it either overclaims or, as this
 * page previously did, reports a measured regression as nothing at all.
 */
export interface EvidenceLink {
  key: "ai" | "ci" | "deployment" | "verdict";
  label: string;
  resolved: boolean;
  /** What the reader should understand from this link's state. */
  detail: string;
}

export function evidenceLinks(change: ChangeSummary): EvidenceLink[] {
  return [
    {
      key: "ai",
      label: "AI session",
      resolved: change.aiVerificationState === "verified",
      detail: change.aiVerificationState === "verified"
        ? "The authoring session's span resolves in SigNoz"
        : "No AI session trace is attached to this commit",
    },
    {
      key: "ci",
      label: "CI run",
      resolved: change.primaryWorkflowConclusion !== null,
      detail: change.primaryWorkflowConclusion !== null
        ? `The primary workflow concluded "${change.primaryWorkflowConclusion}"`
        : "No CI run is linked to this commit",
    },
    {
      key: "deployment",
      label: "Deployment",
      resolved: change.deploymentStatus !== null,
      detail: change.deploymentStatus !== null
        ? "An immutable version was deployed and verified"
        : "No deployment is recorded for this commit",
    },
    {
      key: "verdict",
      label: "Impact verdict",
      resolved: hasDecidedVerdict(change),
      detail: hasDecidedVerdict(change)
        ? "A verdict was reached from SigNoz trace data"
        : "No verdict has been reached from telemetry",
    },
  ];
}

/**
 * Picks the change the landing page offers as the demo receipt.
 *
 * A receipt is worth opening when a deployment happened and telemetry decided
 * something about it — those are the two links that make the page say anything.
 * The AI session is reported alongside rather than required: it is an optional
 * link that is `missing` unless the commit was authored in an instrumented
 * session, and gating on it would suppress a real, measured verdict.
 *
 * The regressed change is preferred, and the ordering is not a matter of taste.
 * A `recovered` verdict belongs to the *revert* commit, which regressed nothing
 * itself, so its receipt carries no impact block — no deltas, no windows, no
 * slow traces. The regressed commit's receipt carries the whole arc: the
 * baseline it was measured against, the regression, and the recovery panel
 * naming the deployment that fixed it. Featuring the revert would send a reader
 * to the thinner of the two artifacts.
 */
const VERDICT_RANK: Record<string, number> = {
  regressed: 0,
  recovered: 1,
  healthy: 2,
};

export function selectFeaturedChange(changes: ChangeSummary[]): ChangeSummary | null {
  const demonstrable = changes.filter(
    (change) => hasDecidedVerdict(change) && change.deploymentStatus !== null,
  );
  if (demonstrable.length === 0) {
    return null;
  }
  return [...demonstrable].sort(
    (a, b) =>
      (VERDICT_RANK[a.regressionStatus ?? ""] ?? 3) -
      (VERDICT_RANK[b.regressionStatus ?? ""] ?? 3),
  )[0];
}
