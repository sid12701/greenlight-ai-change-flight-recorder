import type { ChangeReceipt } from "@greenlight/shared";
import { CheckCircle2, GitCommitHorizontal, RotateCcw } from "lucide-react";
import { formatMilliseconds } from "../../formatters";

export function RecoveryPanel({ receipt }: { receipt: ChangeReceipt }) {
  if (!receipt.recovery) {
    return null;
  }

  const recovered = receipt.recovery.status === "recovered";

  return (
    <section className={`recovery-ribbon recovery-ribbon--${recovered ? "good" : "warn"}`}>
      <div className="recovery-icon" aria-hidden="true">
        {recovered ? <CheckCircle2 size={23} /> : <RotateCcw size={23} />}
      </div>
      <div className="recovery-copy">
        <p className="section-kicker">Recovery</p>
        <h2>{recovered ? "Service returned within policy" : "Recovery in progress"}</h2>
        <p>
          A later deployment measured p95 at{" "}
          <strong>{formatMilliseconds(receipt.recovery.observedP95Ms)}</strong>.
        </p>
      </div>
      <div className="recovery-version">
        <span><GitCommitHorizontal size={14} aria-hidden="true" /> Recovery version</span>
        <code>{receipt.recovery.version?.slice(0, 12) ?? "unresolved"}</code>
      </div>
    </section>
  );
}
