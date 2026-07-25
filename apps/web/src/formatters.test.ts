import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatMilliseconds,
  formatPercent,
} from "./formatters";
import { percentChange } from "./status";

describe("metric formatting", () => {
  it("formats units, precision, nulls, and long values consistently", () => {
    expect(formatMilliseconds(123.45)).toBe("123 ms");
    expect(formatMilliseconds(1_234)).toBe("1.23 s");
    expect(formatMilliseconds(null)).toBe("n/a");
    expect(formatPercent(1.234)).toBe("1.23%");
    expect(formatCount(1_234_567)).toBe("1,234,567");
  });
});

describe("percent change", () => {
  it("reports direction and magnitude", () => {
    expect(percentChange(120, 480)).toBeCloseTo(300);
    expect(percentChange(480, 120)).toBeCloseTo(-75);
  });

  // A percentage change from zero is undefined, not infinite, and rendering
  // "Infinity%" next to a verdict would be worse than saying nothing.
  it("returns null where a percentage is undefined", () => {
    expect(percentChange(0, 5)).toBeNull();
    expect(percentChange(null, 5)).toBeNull();
    expect(percentChange(5, null)).toBeNull();
  });
});
