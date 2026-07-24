import type { ChangeReceipt } from "@greenlight/shared";
import { formatMilliseconds } from "../../formatters";

export function RecoveryPanel({ receipt }: { receipt: ChangeReceipt }) {
  if (!receipt.recovery) {
    return null;
  }

  return (
    <section
      className={
        receipt.recovery.status === "recovered"
          ? "rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4"
          : "rounded-xl border border-amber-900/40 bg-amber-950/20 p-4"
      }
    >
      <h2 className="text-xl font-semibold">Recovery</h2>
      <p className="break-all text-sm">Version {receipt.recovery.version ?? "unresolved"}</p>
      <p className="break-all text-sm">Image {receipt.recovery.imageDigest ?? "unrecorded"}</p>
      <p className="text-sm">Status: {receipt.recovery.status ?? "pending"}</p>
      <p className="text-sm">Observed p95: {formatMilliseconds(receipt.recovery.observedP95Ms)}</p>
    </section>
  );
}
