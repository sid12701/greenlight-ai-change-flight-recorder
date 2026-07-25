import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChangeRow, ChangesPage } from "../changes/ChangesPage";
import { ReceiptPageView } from "./ReceiptPage";
import { ImpactCards } from "./ImpactCards";
import { Actions } from "./Actions";
import { VerdictBanner } from "./VerdictBanner";

describe("changes page", () => {
  afterEach(() => cleanup());
  it("renders loading and empty states", () => {
    const { rerender } = render(<ChangesPage changes={[]} state="loading" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");

    rerender(<ChangesPage changes={[]} state="empty" />);
    expect(screen.getByText(/No changes recorded yet/)).toBeInTheDocument();
  });
});

describe("receipt page", () => {
  afterEach(() => cleanup());
  const receipt = {
    change: {
      commitSha: "a".repeat(40),
      shortSha: "aaaaaaa",
      commitSubject: "docs: proof",
      committedAt: "2026-07-23T10:00:00.000Z",
      branch: "greenlight-demo",
      aiLinkStatus: "linked" as const,
      aiVerificationState: "verified" as const,
      aiTraceparent: null,
      aiSpanContext: null,
      githubUrl: "https://github.com/demo/lms/commit/a",
      changedFilesCount: 1,
      additions: 1,
      deletions: 0,
    },
    pipeline: {
      workflowName: "Backend CI",
      status: "completed",
      conclusion: "success",
      durationMs: 1000,
      slowestStep: "Run tests",
      htmlUrl: "https://github.com/demo/lms/actions/runs/1",
      signozTraceUrl: "http://localhost:8080/trace/abc",
      exportState: "verified" as const,
      isReconstructed: true as const,
    },
    relatedPipelines: [],
    deployment: null,
    impact: {
      route: "/api/v1/internal/home/overview",
      baselineVersion: "b",
      observedVersion: "a",
      baselineRequestCount: 250,
      observedRequestCount: 250,
      baselineP95Ms: 120,
      observedP95Ms: 500,
      baselineP90Ms: 110,
      observedP90Ms: 450,
      baselineErrorRate: 0,
      observedErrorRate: 0,
      status: "regressed" as const,
      reasons: ["latency"],
      thresholds: {
        latencyMultiplier: 1.5,
        latencyAdditiveMs: 250,
        errorRateDeltaPct: 2,
        errorRateAbsolutePct: 5,
        minSpans: 200,
        recoveryLatencyMultiplier: 1.2,
        recoveryErrorRateDeltaPct: 1,
      },
      correlationNote: "correlation only",
      baselineWindow: {
        start: "2026-07-23T10:00:00.000Z",
        end: "2026-07-23T10:01:30.000Z",
      },
      observedWindow: {
        start: "2026-07-23T11:00:00.000Z",
        end: "2026-07-23T11:01:30.000Z",
      },
      policyVersion: "v1",
    },
    evidence: [],
    recovery: null,
    actions: { revertCommand: "git revert abc" },
    caveat: "correlation only",
  };

  it("renders timeline and reconstructed CI labels", () => {
    render(<ReceiptPageView receipt={receipt} />);
    expect(screen.getByText("Primary CI (reconstructed)")).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence timeline")).toBeInTheDocument();
  });

  it("always shows every measured metric, including ones that did not move", () => {
    render(<ImpactCards receipt={receipt} />);
    // An evidence receipt must not hide a metric it measured just because the
    // verdict was driven by a different one.
    const headings = [...document.querySelectorAll("h3")].map((h) => h.textContent);
    expect(headings).toEqual(expect.arrayContaining(["p95", "Error rate", "Samples"]));
  });

  it("labels the verdict on the impact section", () => {
    render(<ImpactCards receipt={receipt} />);
    expect(screen.getByText("Regressed")).toBeInTheDocument();
  });

  it("separates a missing evaluation from an insufficient-data verdict", () => {
    const { rerender } = render(<ImpactCards receipt={{ ...receipt, impact: null }} />);
    expect(screen.getByText(/No impact evaluation has been recorded/)).toBeInTheDocument();

    rerender(<ImpactCards receipt={{
      ...receipt,
      impact: { ...receipt.impact, status: "insufficient_data" as const },
    }} />);
    expect(screen.getByText("Insufficient data")).toBeInTheDocument();
  });

  it("presents an integration failure as a dependency error, never as a verdict", () => {
    render(<ImpactCards receipt={{
      ...receipt,
      impact: { ...receipt.impact, status: "integration_error" as const },
    }} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/dependency failure, not a healthy result/);
  });

  it("does not render an unverified evidence link", () => {
    render(<ReceiptPageView receipt={{
      ...receipt,
      evidence: [
        { kind: "signoz_trace" as const, label: "Verified slow trace",
          url: "http://signoz.test/trace/aaaa", verificationState: "verified" as const },
        { kind: "signoz_trace" as const, label: "Unresolved slow trace",
          url: "http://signoz.test/trace/bbbb", verificationState: "failed" as const },
      ],
    }} />);
    expect(screen.getByRole("link", { name: "Verified slow trace" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Unresolved slow trace" })).not.toBeInTheDocument();
    expect(screen.getByText(/Unresolved slow trace \(failed; link withheld\)/)).toBeInTheDocument();
  });

  it("never renders a missing AI link in the success colour", () => {
    const { container } = render(<ReceiptPageView receipt={{
      ...receipt,
      change: { ...receipt.change, aiLinkStatus: "missing" as const,
        aiVerificationState: "missing" as const },
    }} />);
    const line = [...container.querySelectorAll("p")]
      .find((element) => element.textContent?.startsWith("AI link:"));
    expect(line?.className).not.toContain("emerald");
    expect(line?.className).toContain("red");
  });

  it("shows an unresolved deployment version instead of guessing one", () => {
    render(<ReceiptPageView receipt={{
      ...receipt,
      deployment: {
        id: "dep_1", serviceName: "lms-backend", environmentName: "hackathon-demo",
        version: null, role: "candidate", status: "succeeded",
        deployedAt: "2026-07-23T11:00:00.000Z", imageDigest: null,
        versionState: "pending" as const, traceState: "failed" as const,
      },
    }} />);
    expect(screen.getByText("unresolved")).toBeInTheDocument();
  });

  it("shows copy fallback when clipboard fails", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: async () => {
          throw new Error("blocked");
        },
      },
    });
    render(<Actions receipt={receipt} />);
    screen.getByRole("button", { name: /Copy revert command/ }).click();
    expect(await screen.findByText(/Clipboard blocked/)).toBeInTheDocument();
  });
});

describe("verdict-first receipt", () => {
  afterEach(() => cleanup());

  const impact = {
    route: "/balances",
    baselineVersion: "b",
    observedVersion: "a",
    baselineRequestCount: 250,
    observedRequestCount: 250,
    baselineP95Ms: 120,
    observedP95Ms: 480,
    baselineP90Ms: 110,
    observedP90Ms: 450,
    baselineErrorRate: 0.5,
    observedErrorRate: 11,
    status: "regressed" as const,
    reasons: ["latency"],
    thresholds: {
      latencyMultiplier: 1.5,
      latencyAdditiveMs: 250,
      errorRateDeltaPct: 2,
      errorRateAbsolutePct: 5,
      minSpans: 200,
      recoveryLatencyMultiplier: 1.2,
      recoveryErrorRateDeltaPct: 1,
    },
    correlationNote: "correlation only",
    baselineWindow: { start: "2026-07-25T10:00:00.000Z", end: "2026-07-25T10:01:30.000Z" },
    observedWindow: { start: "2026-07-25T11:00:00.000Z", end: "2026-07-25T11:01:30.000Z" },
    policyVersion: "v1",
  };
  const base = {
    change: {
      commitSha: "a".repeat(40),
      shortSha: "aaaaaaa",
      commitSubject: "feat: raise loan cap",
      committedAt: "2026-07-25T10:00:00.000Z",
      branch: "main",
      aiLinkStatus: "linked" as const,
      aiVerificationState: "verified" as const,
      aiTraceparent: null,
      aiSpanContext: null,
      githubUrl: "https://github.com/demo/blnk/commit/a",
      changedFilesCount: 1,
      additions: 1,
      deletions: 0,
    },
    pipeline: null,
    relatedPipelines: [],
    deployment: null,
    impact,
    evidence: [],
    recovery: null,
    actions: { revertCommand: "git revert a" },
    caveat: "correlation only",
  };

  it("states the verdict and both deltas above the supporting detail", () => {
    render(<VerdictBanner receipt={base} />);

    expect(screen.getByRole("heading", { name: "Regressed" })).toBeInTheDocument();
    expect(screen.getByText(/breached the applied policy/)).toBeInTheDocument();
    // 120 ms → 480 ms is +300%; 0.5% → 11% is +2100%.
    expect(screen.getByText("+300%")).toBeInTheDocument();
    expect(screen.getByText("+2100%")).toBeInTheDocument();
  });

  it("puts the verdict before the evidence that supports it", () => {
    render(<ReceiptPageView receipt={base} />);

    const headings = [...document.querySelectorAll("h2")].map((node) => node.textContent);
    expect(headings[0]).toBe("Regressed");
    expect(headings.indexOf("Impact")).toBeGreaterThan(0);
  });

  it("says a metric was not measured rather than implying it did not move", () => {
    render(
      <VerdictBanner
        receipt={{ ...base, impact: { ...impact, observedErrorRate: null } }}
      />,
    );
    expect(screen.getByText("not measured")).toBeInTheDocument();
  });

  it("never presents an integration error as a passing verdict", () => {
    render(
      <VerdictBanner
        receipt={{ ...base, impact: { ...impact, status: "integration_error" as const } }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Integration error" })).toBeInTheDocument();
    expect(screen.getByText(/this is not a pass/)).toBeInTheDocument();
  });

  it("asks for an evaluation when none has run", () => {
    render(<VerdictBanner receipt={{ ...base, impact: null }} />);
    expect(screen.getByRole("heading", { name: "Not evaluated" })).toBeInTheDocument();
  });
});

describe("change list badges", () => {
  afterEach(() => cleanup());

  const summary = {
    commitSha: "a".repeat(40),
    shortSha: "aaaaaaa",
    commitSubject: "feat: raise loan cap",
    committedAt: "2026-07-25T10:00:00.000Z",
    aiLinkStatus: "linked" as const,
    aiVerificationState: "verified" as const,
    primaryWorkflowName: "Build and Test",
    primaryWorkflowConclusion: "success",
    deploymentStatus: "succeeded",
    regressionStatus: "regressed" as const,
    relatedPipelineCount: 1,
  };

  // Previously every badge was the same neutral grey, so a regressed change
  // and a healthy one were indistinguishable at a glance.
  it("distinguishes a regressed change from a healthy one", () => {
    const { container, rerender } = render(<ChangeRow change={summary} />);
    const regressed = container.querySelector('[title*="breached"]');
    expect(regressed?.className).toContain("red");

    rerender(<ChangeRow change={{ ...summary, regressionStatus: "healthy" }} />);
    const healthy = container.querySelector('[title*="stayed within"]');
    expect(healthy?.className).toContain("emerald");
  });

  it("gives every badge a written meaning, not colour alone", () => {
    render(<ChangeRow change={summary} />);

    expect(screen.getByText(/Production metrics breached the applied policy/)).toBeInTheDocument();
    expect(screen.getByText(/The referenced span was found in SigNoz/)).toBeInTheDocument();
    expect(screen.getByText(/The CI workflow concluded successfully/)).toBeInTheDocument();
    expect(screen.getByText(/The image reached the target environment/)).toBeInTheDocument();
  });

  it("keeps an unknown CI conclusion neutral instead of guessing a pass", () => {
    const { container } = render(
      <ChangeRow change={{ ...summary, primaryWorkflowConclusion: "neutral" }} />,
    );
    const badge = container.querySelector('[title*="GitHub reported"]');
    expect(badge?.className).toContain("slate");
  });
});
