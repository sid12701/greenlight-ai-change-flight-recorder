import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChangesPage } from "../changes/ChangesPage";
import { ReceiptPageView } from "./ReceiptPage";
import { ImpactCards } from "./ImpactCards";
import { Actions } from "./Actions";

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
