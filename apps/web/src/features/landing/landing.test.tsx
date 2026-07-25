import type { ChangeSummary, DependencyStatus } from "@greenlight/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { chainCompleteness, selectFeaturedChange } from "./featured";
import { LandingPage } from "./LandingPage";

function change(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
  return {
    commitSha: "a".repeat(40),
    shortSha: "aaaaaaa",
    commitSubject: "feat: add loan cap",
    committedAt: "2026-07-25T10:00:00.000Z",
    aiLinkStatus: "linked",
    aiVerificationState: "verified",
    primaryWorkflowName: "Build and Test",
    primaryWorkflowConclusion: "success",
    deploymentStatus: "succeeded",
    regressionStatus: "healthy",
    relatedPipelineCount: 1,
    ...overrides,
  };
}

const HEALTHY: DependencyStatus = {
  status: "ok",
  checks: { database: "ok", github: "ok", signoz: "ok" },
};

describe("evidence chain completeness", () => {
  it("requires every link to resolve", () => {
    expect(chainCompleteness(change())).toBe("complete");
    expect(chainCompleteness(change({ aiVerificationState: "unverified" }))).toBe("partial");
    expect(chainCompleteness(change({ deploymentStatus: null }))).toBe("partial");
  });

  it("does not treat an undecided verdict as a link", () => {
    expect(chainCompleteness(change({ regressionStatus: "insufficient_data" }))).toBe("partial");
    expect(chainCompleteness(change({ regressionStatus: "integration_error" }))).toBe("partial");
    expect(chainCompleteness(change({ regressionStatus: null }))).toBe("partial");
  });

  it("reports a bare commit as having no chain", () => {
    expect(chainCompleteness(change({
      aiVerificationState: "missing",
      primaryWorkflowConclusion: null,
      deploymentStatus: null,
      regressionStatus: null,
    }))).toBe("none");
  });
});

describe("featured change selection", () => {
  // The regressed commit's receipt carries the impact block and the recovery
  // panel; the `recovered` verdict belongs to the revert, whose own receipt has
  // no regression to report. Featuring the revert sends a reader to the thinner
  // artifact, which is what made this ordering worth pinning down in a test.
  it("prefers the regressed change over the revert that recovered it", () => {
    const healthy = change({ commitSha: "b".repeat(40), regressionStatus: "healthy" });
    const regressed = change({ commitSha: "d".repeat(40), regressionStatus: "regressed" });
    const recovered = change({ commitSha: "c".repeat(40), regressionStatus: "recovered" });

    expect(selectFeaturedChange([healthy, recovered, regressed])?.commitSha).toBe("d".repeat(40));
    expect(selectFeaturedChange([healthy, recovered])?.commitSha).toBe("c".repeat(40));
  });

  // The AI session is optional evidence. Gating the featured receipt on it once
  // meant a real, measured regression was reported to every reader as "no
  // complete chain yet" — the product suppressing its own finding.
  it("still features a measured verdict when the AI session is not linked", () => {
    const measured = change({
      aiLinkStatus: "missing",
      aiVerificationState: "missing",
      regressionStatus: "regressed",
    });

    expect(chainCompleteness(measured)).toBe("partial");
    expect(selectFeaturedChange([measured])?.commitSha).toBe("a".repeat(40));
  });

  // A receipt can only report a verdict about a version that was deployed and
  // measured; offering anything less as the demo would be overclaiming.
  it("offers nothing without a deployment and a decided verdict", () => {
    expect(selectFeaturedChange([change({ deploymentStatus: null })])).toBeNull();
    expect(selectFeaturedChange([change({ regressionStatus: "insufficient_data" })])).toBeNull();
    expect(selectFeaturedChange([change({ regressionStatus: "integration_error" })])).toBeNull();
    expect(selectFeaturedChange([])).toBeNull();
  });
});

describe("landing page", () => {
  afterEach(() => cleanup());

  it("states the promise and links the verified receipt", () => {
    render(
      <LandingPage
        changes={[change({ regressionStatus: "recovered" })]}
        signozUrl="http://signoz.test"
        state="ready"
        status={HEALTHY}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "flight recorder for AI-written code",
    );
    expect(screen.getByRole("link", { name: /Open the verified receipt/ })).toHaveAttribute(
      "href",
      `/changes/${"a".repeat(40)}`,
    );
    expect(screen.getByRole("link", { name: /Open SigNoz/ })).toHaveAttribute(
      "href",
      "http://signoz.test",
    );
  });

  it("offers the receipt and names the unresolved link when the AI session is missing", () => {
    render(
      <LandingPage
        changes={[change({
          aiLinkStatus: "missing",
          aiVerificationState: "missing",
          regressionStatus: "regressed",
        })]}
        signozUrl="http://signoz.test"
        state="ready"
        status={HEALTHY}
      />,
    );

    // The receipt must stay one click away: this is the whole demo.
    expect(screen.getByRole("link", { name: /Open the verified receipt/ })).toHaveAttribute(
      "href",
      `/changes/${"a".repeat(40)}`,
    );
    expect(screen.getByText(/3 of 4 links resolve/)).toBeInTheDocument();
    // Stated in words, not by colour or a glyph alone.
    expect(
      screen.getByText(/not linked — No AI session trace is attached to this commit/),
    ).toBeInTheDocument();
  });

  it("gives an empty install a runnable next action instead of a blank screen", () => {
    render(
      <LandingPage changes={[]} signozUrl="http://signoz.test" state="ready" status={HEALTHY} />,
    );

    expect(screen.queryByRole("link", { name: /Open the verified receipt/ })).toBeNull();
    expect(screen.getByText(/No changes have been recorded yet/)).toBeInTheDocument();
    // The command shown must be the one that actually produces a complete
    // chain, otherwise an empty install is told to run something that leaves
    // it empty.
    expect(screen.getByText(/scripts\/demo-chain\.mjs/)).toBeInTheDocument();
  });

  it("names each degraded dependency and how to fix it", () => {
    render(
      <LandingPage
        changes={[]}
        signozUrl="http://signoz.test"
        state="ready"
        status={{
          status: "degraded",
          checks: { database: "ok", github: "degraded", signoz: "degraded" },
        }}
      />,
    );

    // Colour alone would not tell a reader which dependency is down.
    expect(screen.getAllByText("degraded")).toHaveLength(2);
    expect(screen.getByText("healthy")).toBeInTheDocument();
    expect(
      screen.getByText(/Check GITHUB_REPOSITORY and GITHUB_TOKEN/),
    ).toBeInTheDocument();
  });

  it("says the API is unreachable rather than reporting it healthy", () => {
    render(
      <LandingPage
        changes={[]}
        signozUrl="http://signoz.test"
        state="unreachable"
        status={null}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("could not be reached");
    expect(screen.queryByText("healthy")).toBeNull();
  });
});
