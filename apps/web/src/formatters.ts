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

/**
 * Each unit with the span it covers before the next one takes over.
 *
 * The limit is per-unit rather than a fixed multiple of the scale: seconds and
 * minutes give way after sixty, but hours give way after twenty-four. Using one
 * multiple for all of them left evidence a day and a half old reading
 * "36 hours ago", which is the one phrasing that answers nothing.
 */
const RELATIVE_UNITS: Array<{
  unit: Intl.RelativeTimeFormatUnit;
  scale: number;
  limit: number;
}> = [
  { unit: "second", scale: 1_000, limit: 60_000 },
  { unit: "minute", scale: 60_000, limit: 3_600_000 },
  { unit: "hour", scale: 3_600_000, limit: 86_400_000 },
  { unit: "day", scale: 86_400_000, limit: Number.POSITIVE_INFINITY },
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
  const { unit, scale } = RELATIVE_UNITS.find(
    (candidate) => Math.abs(elapsed) < candidate.limit,
  ) ?? RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" })
    .format(Math.round(elapsed / scale), unit);
}
