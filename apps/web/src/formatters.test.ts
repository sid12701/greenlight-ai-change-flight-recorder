import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatMilliseconds,
  formatPercent,
  formatRelativeTime,
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

describe("relative time", () => {
  const now = Date.parse("2026-07-25T12:00:00.000Z");

  it("describes how old evidence is in the reader's terms", () => {
    expect(formatRelativeTime("2026-07-25T11:58:00.000Z", now)).toBe("2 minutes ago");
    expect(formatRelativeTime("2026-07-25T09:00:00.000Z", now)).toBe("3 hours ago");
    expect(formatRelativeTime("2026-07-22T12:00:00.000Z", now)).toBe("3 days ago");
  });

  it("reports an unparseable timestamp instead of rendering a plausible one", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("invalid date");
  });
});
