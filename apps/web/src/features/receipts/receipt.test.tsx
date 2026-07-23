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
      },
      correlationNote: "correlation only",
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

  it("suppresses unchanged error headline in latency-only mode", () => {
    render(<ImpactCards receipt={receipt} />);
    expect(screen.queryByText(/Error rate/)).not.toBeInTheDocument();
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
