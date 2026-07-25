import { describe, expect, it } from "vitest";
import { ApiError, ResponseContractError } from "./api/client";
import { describeFailure } from "./failures";

describe("failure presentation", () => {
  it("gives each API failure a distinct recovery path", () => {
    const seen = new Set<string>();
    for (const status of [401, 403, 404, 503]) {
      const failure = describeFailure(ApiError.fromStatus(status));
      expect(failure.title).not.toBe("");
      expect(failure.action).not.toBe("");
      seen.add(failure.title);
    }
    // Four different causes must not collapse into one message; that
    // collapse is the defect this module exists to prevent.
    expect(seen.size).toBe(4);
  });

  it("sends a missing receipt back to the change list rather than a dead end", () => {
    const failure = describeFailure(ApiError.fromStatus(404));
    expect(failure.href).toBe("/changes");
    expect(failure.command).toBeUndefined();
  });

  it("distinguishes an unreachable API from a degraded one", () => {
    const unreachable = describeFailure(new ApiError(0, "unavailable", "no route"));
    const degraded = describeFailure(ApiError.fromStatus(503));
    expect(unreachable.detail).toMatch(/could not be reached/i);
    expect(degraded.detail).toMatch(/dependencies/i);
  });

  it("treats a contract mismatch as a build problem, not an outage", () => {
    const failure = describeFailure(new ResponseContractError([]));
    expect(failure.title).toMatch(/does not recognise/i);
    expect(failure.command).toBe("npm run build");
  });

  it("still explains a failure that is not an ApiError", () => {
    const failure = describeFailure(new Error("boom"));
    expect(failure.detail).toBe("boom");
    expect(failure.action).not.toBe("");
  });
});
