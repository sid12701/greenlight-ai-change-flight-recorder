import type { ChangeReceipt } from "@greenlight/shared";
import { formatDateTime, formatRelativeTime } from "../../formatters";

/**
 * States how old the evidence is.
 *
 * A verdict with no age reads as current no matter when it was measured, which
 * is how a stale receipt gets trusted. The window's end is used rather than a
 * render time, because that is the last moment the telemetry actually
 * describes; anything after it is unmeasured.
 */
export function EvidenceFreshness({ receipt }: { receipt: ChangeReceipt }) {
  const measuredTo = receipt.impact?.observedWindow.end;
  if (!measuredTo) {
    return null;
  }
  return (
    <p className="text-sm text-slate-400">
      Measured up to{" "}
      <time dateTime={measuredTo} className="text-slate-300">
        {formatDateTime(measuredTo)}
      </time>{" "}
      ({formatRelativeTime(measuredTo)}). Nothing after that time is covered by
      this verdict.
      {receipt.impact?.policyVersion
        ? ` Policy ${receipt.impact.policyVersion}.`
        : null}
    </p>
  );
}
