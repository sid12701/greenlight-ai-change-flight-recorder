import { describe, expect, it } from "vitest";
import { matchAppRoute } from "./routes";

describe("application route matching", () => {
  it("serves the landing page at the root and the list under /changes", () => {
    expect(matchAppRoute("/")).toEqual({ page: "landing" });
    expect(matchAppRoute("/changes")).toEqual({ page: "changes" });
    expect(matchAppRoute("/changes/")).toEqual({ page: "changes" });
  });

  it("accepts only a full commit SHA and normalizes its case", () => {
    const sha = "A".repeat(40);
    expect(matchAppRoute(`/changes/${sha}`)).toEqual({
      page: "receipt",
      commitSha: sha.toLowerCase(),
    });
    expect(matchAppRoute("/changes/abc")).toEqual({ page: "not-found" });
  });

  it("returns an explicit not-found route", () => {
    expect(matchAppRoute("/unknown")).toEqual({ page: "not-found" });
  });
});
