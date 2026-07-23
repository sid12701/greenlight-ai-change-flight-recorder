import type { ChangeReceipt } from "@greenlight/shared";

export function RecoveryPanel({ receipt }: { receipt: ChangeReceipt }) {
  if (!receipt.recovery) {
    return null;
  }

  return (
    <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4">
      <h2 className="text-xl font-semibold">Recovery</h2>
      <p className="text-sm">Version {receipt.recovery.version}</p>
      <p className="text-sm">Status: {receipt.recovery.status ?? "pending"}</p>
      <p className="text-sm">Observed p95: {receipt.recovery.observedP95Ms ?? "n/a"} ms</p>
    </section>
  );
}
