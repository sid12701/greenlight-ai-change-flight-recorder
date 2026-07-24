import { describe, expect, it } from "vitest";
import { ChangeListResponseSchema } from "./schemas.js";

describe("runtime API contracts", () => {
  it("rejects malformed change list responses", () => {
    expect(() => ChangeListResponseSchema.parse({
      changes: [{
        commitSha: "short",
        shortSha: "short",
        commitSubject: null,
        committedAt: null,
        aiLinkStatus: "linked",
        aiVerificationState: "verified",
        primaryWorkflowName: null,
        primaryWorkflowConclusion: null,
        deploymentStatus: null,
        regressionStatus: null,
        relatedPipelineCount: 0,
      }],
    })).toThrow();
  });
});
