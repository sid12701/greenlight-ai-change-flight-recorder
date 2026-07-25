export function formatMilliseconds(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 1 : 2)} s`;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ms`;
}

export function formatPercent(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

export function formatCount(value: number | null): string {
  return value === null ? "n/a" : new Intl.NumberFormat("en-US").format(value);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(date)
    : "invalid date";
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["second", 1_000],
  ["minute", 60_000],
  ["hour", 3_600_000],
  ["day", 86_400_000],
];

/**
 * How old a piece of evidence is, in words.
 *
 * An absolute timestamp alone does not answer the question a reader is really
 * asking, which is whether the verdict still describes what is running. The
 * absolute time is kept alongside this, because "3 hours ago" is useless when
 * comparing two receipts.
 */
export function formatRelativeTime(value: string, now: number = Date.now()): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return "invalid date";
  }
  const elapsed = timestamp - now;
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let unit: Intl.RelativeTimeFormatUnit = "day";
  let scale = 86_400_000;
  for (const [candidate, candidateScale] of RELATIVE_UNITS) {
    if (Math.abs(elapsed) < candidateScale * 60 || candidate === "day") {
      unit = candidate;
      scale = candidateScale;
      break;
    }
  }
  return format.format(Math.round(elapsed / scale), unit);
}
