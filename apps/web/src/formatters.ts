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
