import type { ChangeReceipt } from "@greenlight/shared";
import { Clock3 } from "lucide-react";
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
    <p className="freshness-bar">
      <Clock3 size={15} aria-hidden="true" />
      <span>
        Measured up to{" "}
        <time dateTime={measuredTo}>
          {formatDateTime(measuredTo)}
        </time>{" "}
        ({formatRelativeTime(measuredTo)}). Nothing after that time is covered by
        this verdict.
      </span>
      {receipt.impact?.policyVersion
        ? <strong>Policy {receipt.impact.policyVersion}</strong>
        : null}
    </p>
  );
}
