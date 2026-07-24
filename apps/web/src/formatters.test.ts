import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatMilliseconds,
  formatPercent,
} from "./formatters";

describe("metric formatting", () => {
  it("formats units, precision, nulls, and long values consistently", () => {
    expect(formatMilliseconds(123.45)).toBe("123 ms");
    expect(formatMilliseconds(1_234)).toBe("1.23 s");
    expect(formatMilliseconds(null)).toBe("n/a");
    expect(formatPercent(1.234)).toBe("1.23%");
    expect(formatCount(1_234_567)).toBe("1,234,567");
  });
});
