import type { RegressionStatus, VerificationState } from "@greenlight/shared";

/**
 * How a status should read, not just how it should look.
 *
 * Every badge in the product resolves through here so a colour never means one
 * thing on the change list and another on a receipt, and so each badge carries
 * a written meaning for readers who do not perceive the colour.
 */
export type Tone = "good" | "bad" | "warn" | "neutral";

export interface StatusPresentation {
  label: string;
  tone: Tone;
  /** Plain-language explanation, surfaced as the badge's accessible name. */
  meaning: string;
}

export const TONE_CLASS: Record<Tone, string> = {
  good: "bg-emerald-950/40 text-emerald-200 ring-1 ring-emerald-800",
  bad: "bg-red-950/40 text-red-200 ring-1 ring-red-800",
  warn: "bg-amber-950/40 text-amber-200 ring-1 ring-amber-800",
  neutral: "bg-slate-800 text-slate-200 ring-1 ring-slate-700",
};

const REGRESSION: Record<RegressionStatus, StatusPresentation> = {
  healthy: {
    label: "Healthy",
    tone: "good",
    meaning: "Production metrics stayed within the applied policy after this change shipped",
  },
  regressed: {
    label: "Regressed",
    tone: "bad",
    meaning: "Production metrics breached the applied policy after this change shipped",
  },
  recovered: {
    label: "Recovered",
    tone: "good",
    meaning: "A regression was detected and a later deployment returned metrics within policy",
  },
  insufficient_data: {
    label: "Insufficient data",
    tone: "warn",
    meaning: "An evaluation ran but the window held too few spans to decide",
  },
  integration_error: {
    label: "Integration error",
    tone: "bad",
    meaning: "SigNoz could not return metrics, so no verdict was reached — this is not a pass",
  },
};

export function regressionPresentation(
  status: RegressionStatus | null,
): StatusPresentation {
  return status === null
    ? {
      label: "Not evaluated",
      tone: "neutral",
      meaning: "No impact evaluation has run for this change yet",
    }
    : REGRESSION[status];
}

const VERIFICATION: Record<VerificationState, StatusPresentation> = {
  verified: {
    label: "Verified",
    tone: "good",
    meaning: "The referenced span was found in SigNoz",
  },
  unverified: {
    label: "Unverified",
    tone: "warn",
    meaning: "A trace was recorded but has not been confirmed in SigNoz",
  },
  missing: {
    label: "Missing",
    tone: "bad",
    meaning: "No AI session trace was attached to this commit",
  },
  invalid: {
    label: "Invalid",
    tone: "bad",
    meaning: "The attached trace context could not be parsed",
  },
  failed: {
    label: "Failed",
    tone: "bad",
    meaning: "Verification ran and the referenced span was not found in SigNoz",
  },
};

export function verificationPresentation(state: VerificationState): StatusPresentation {
  return VERIFICATION[state];
}

/**
 * CI conclusions come from GitHub as free-form strings, so unknown values must
 * stay neutral rather than being guessed into a pass or a failure.
 */
export function conclusionPresentation(conclusion: string | null): StatusPresentation {
  switch (conclusion) {
    case "success":
      return { label: "Passed", tone: "good", meaning: "The CI workflow concluded successfully" };
    case "failure":
      return { label: "Failed", tone: "bad", meaning: "The CI workflow concluded with a failure" };
    case "cancelled":
    case "timed_out":
      return {
        label: conclusion === "cancelled" ? "Cancelled" : "Timed out",
        tone: "warn",
        meaning: `The CI workflow ${conclusion === "cancelled" ? "was cancelled" : "timed out"} without a result`,
      };
    case null:
      return { label: "No run", tone: "neutral", meaning: "No CI run is linked to this commit" };
    default:
      return { label: conclusion, tone: "neutral", meaning: `GitHub reported "${conclusion}"` };
  }
}

export function deploymentPresentation(status: string | null): StatusPresentation {
  switch (status) {
    case "succeeded":
      return { label: "Deployed", tone: "good", meaning: "The image reached the target environment" };
    case "failed":
      return { label: "Deploy failed", tone: "bad", meaning: "The deployment did not complete" };
    case null:
      return { label: "Not deployed", tone: "neutral", meaning: "No deployment is recorded for this commit" };
    default:
      return { label: status, tone: "neutral", meaning: `Deployment status "${status}"` };
  }
}

/**
 * Percentage change between two measurements, or null when either is missing
 * or the baseline is zero (where a percentage is undefined, not infinite).
 */
export function percentChange(baseline: number | null, observed: number | null): number | null {
  if (baseline === null || observed === null || baseline === 0) {
    return null;
  }
  return ((observed - baseline) / baseline) * 100;
}
