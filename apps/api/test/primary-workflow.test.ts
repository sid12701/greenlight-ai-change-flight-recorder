import { describe, expect, it } from "vitest";
import {
  markPrimaryRuns,
  PrimaryWorkflowConfigurationError,
  selectPrimaryWorkflow,
} from "../src/modules/github/primary-workflow.js";

describe("primary workflow selection", () => {
  const runs = [
    { providerRunId: "100", workflowName: "Backend CI", isPrimary: false },
    { providerRunId: "200", workflowName: "Frontend CI", isPrimary: false },
  ];

  it("marks exactly one backend run as primary", () => {
    const marked = markPrimaryRuns(runs, "Backend CI");
    expect(marked.filter((run) => run.isPrimary)).toEqual([
      { providerRunId: "100", workflowName: "Backend CI", isPrimary: true },
    ]);
  });

  it("throws when no primary workflow matches", () => {
    expect(() => selectPrimaryWorkflow(runs, "Deploy")).toThrow(
      PrimaryWorkflowConfigurationError,
    );
  });

  // `on: [push, pull_request]` produces two runs of one workflow for a commit
  // on any branch with an open pull request. Refusing to choose rejected the
  // commit outright, and the documented escape hatch could not help: every run
  // of one workflow carries that workflow's ID.
  it("takes the latest run when one workflow ran twice for a commit", () => {
    const rerun = [
      {
        providerRunId: "100",
        workflowName: "Backend CI",
        workflowId: 42,
        updatedAtMs: Date.parse("2026-07-25T10:00:00.000Z"),
      },
      {
        providerRunId: "101",
        workflowName: "Backend CI",
        workflowId: 42,
        updatedAtMs: Date.parse("2026-07-25T11:00:00.000Z"),
      },
    ];
    expect(selectPrimaryWorkflow(rerun, "Backend CI").providerRunId).toBe("101");
    // Selecting by ID must agree; it identifies the same single workflow.
    expect(selectPrimaryWorkflow(rerun, "Backend CI", 42).providerRunId).toBe("101");
  });

  it("orders identical timestamps by run ID so the choice is reproducible", () => {
    const tied = [
      { providerRunId: "100", workflowName: "Backend CI", workflowId: 42, updatedAtMs: 1 },
      { providerRunId: "101", workflowName: "Backend CI", workflowId: 42, updatedAtMs: 1 },
    ];
    expect(selectPrimaryWorkflow(tied, "Backend CI").providerRunId).toBe("101");
    expect(selectPrimaryWorkflow([...tied].reverse(), "Backend CI").providerRunId).toBe("101");
  });

  it("marks only the chosen run primary, keeping the other as context", () => {
    const rerun = [
      { providerRunId: "100", workflowName: "Backend CI", workflowId: 42, updatedAtMs: 1, isPrimary: false },
      { providerRunId: "101", workflowName: "Backend CI", workflowId: 42, updatedAtMs: 2, isPrimary: false },
    ];
    const marked = markPrimaryRuns(rerun, "Backend CI");
    expect(marked.map((run) => run.isPrimary)).toEqual([false, true]);
    // No run is dropped: the receipt still reports the other as related.
    expect(marked).toHaveLength(2);
  });

  // Two different checks sharing a name is a real ambiguity that no ordering
  // resolves, so it must still be refused rather than guessed.
  it("refuses when the name matches two distinct workflows", () => {
    const collision = [
      { providerRunId: "100", workflowName: "CI", workflowId: 42, updatedAtMs: 1 },
      { providerRunId: "200", workflowName: "CI", workflowId: 77, updatedAtMs: 2 },
    ];
    expect(() => selectPrimaryWorkflow(collision, "CI")).toThrow(
      PrimaryWorkflowConfigurationError,
    );
    // ...and naming the workflow by ID is the escape hatch that resolves it.
    expect(selectPrimaryWorkflow(collision, "CI", 77).providerRunId).toBe("200");
  });

  it("refuses when the matched runs cannot be attributed to a workflow", () => {
    const unidentified = [
      { providerRunId: "100", workflowName: "Backend CI" },
      { providerRunId: "101", workflowName: "Backend CI" },
    ];
    expect(() => selectPrimaryWorkflow(unidentified, "Backend CI")).toThrow(
      PrimaryWorkflowConfigurationError,
    );
  });

  it("keeps frontend runs as secondary context", () => {
    const marked = markPrimaryRuns(runs, "Backend CI");
    const frontend = marked.find((run) => run.workflowName === "Frontend CI");
    expect(frontend?.isPrimary).toBe(false);
  });
});
