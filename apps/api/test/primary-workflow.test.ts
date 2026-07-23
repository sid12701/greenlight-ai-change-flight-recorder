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

  it("throws when multiple primary workflows match", () => {
    const duplicate = [
      { providerRunId: "100", workflowName: "Backend CI" },
      { providerRunId: "101", workflowName: "Backend CI" },
    ];
    expect(() => selectPrimaryWorkflow(duplicate, "Backend CI")).toThrow(
      PrimaryWorkflowConfigurationError,
    );
  });

  it("keeps frontend runs as secondary context", () => {
    const marked = markPrimaryRuns(runs, "Backend CI");
    const frontend = marked.find((run) => run.workflowName === "Frontend CI");
    expect(frontend?.isPrimary).toBe(false);
  });
});
