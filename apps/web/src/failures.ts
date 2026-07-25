/**
 * One place that turns a failure into something a reader can act on.
 *
 * "Receipt unavailable" collapses "you are not signed in", "this commit was
 * never recorded" and "SigNoz is down" into one indistinguishable state, and
 * each of those needs a different next step. The API already distinguishes
 * them; this keeps that distinction all the way to the screen.
 */
import { ApiError, ResponseContractError } from "./api/client";

export interface FailurePresentation {
  /** What happened, in the reader's terms. */
  title: string;
  /** Why it happened, without restating the title. */
  detail: string;
  /** The single next step. */
  action: string;
  /** A command to run, when the next step is a command. */
  command?: string;
  /** Somewhere useful to go, when the next step is navigation. */
  href?: string;
  hrefLabel?: string;
}

export function describeFailure(error: unknown): FailurePresentation {
  if (error instanceof ResponseContractError) {
    return {
      title: "This page does not recognise the API's response",
      detail:
        "The API answered successfully, but with a shape the interface does not " +
        "understand. That normally means the two were built from different commits.",
      action: "Rebuild both from the same checkout.",
      command: "npm run build",
    };
  }

  if (error instanceof ApiError) {
    switch (error.code) {
      case "unauthorized":
        return {
          title: "Reading changes requires sign-in",
          detail: "The API is configured to require authentication for reads.",
          action:
            "Set GREENLIGHT_REQUIRE_READ_AUTH=false in .env.demo for a local demo, " +
            "or front the API with something that issues a per-user session.",
        };
      case "forbidden":
        return {
          title: "This session may not read changes",
          detail: "The credential reached the API but does not carry the read scope.",
          action: "Grant the read scope to the key in GREENLIGHT_API_KEYS.",
        };
      case "not_found":
        return {
          title: "No receipt exists for this commit",
          detail:
            "GreenLight only holds commits it has synced. A commit that was never " +
            "synced, or one from a different repository, has no receipt.",
          action: "Check the commit list, or sync the run that produced it.",
          href: "/changes",
          hrefLabel: "All changes",
        };
      case "unavailable":
        return {
          title: "GreenLight is degraded",
          detail:
            error.status === 0
              ? "The API could not be reached at all."
              : "The API answered, but one of its dependencies did not.",
          action: "The overview names which dependency is failing and how to restore it.",
          href: "/",
          hrefLabel: "Dependency readiness",
          command: "npm run demo:status",
        };
      default:
        return {
          title: `The API responded with ${error.status}`,
          detail: error.message,
          action: "Check the API logs for this request.",
          command: "docker compose -f deploy/compose.local.yaml logs api",
        };
    }
  }

  return {
    title: "Something failed before the receipt could load",
    detail: error instanceof Error ? error.message : "The cause was not reported.",
    action: "Check the API logs for this request.",
    command: "docker compose -f deploy/compose.local.yaml logs api",
  };
}
