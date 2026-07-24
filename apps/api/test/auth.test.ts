import { describe, expect, it } from "vitest";
import { safeTokenEqual } from "../src/http/auth.js";

describe("local token fallback", () => {
  it("uses fixed-size digests for equal and unequal-length comparisons", () => {
    expect(safeTokenEqual("same-token", "same-token")).toBe(true);
    expect(safeTokenEqual("short", "a-much-longer-token")).toBe(false);
  });
});
