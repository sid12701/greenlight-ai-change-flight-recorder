import type { ChangeReceipt } from "@greenlight/shared";
import { EvidenceTimeline } from "./EvidenceTimeline";
import { CiSection } from "./CiSection";
import { ImpactCards } from "./ImpactCards";
import { RecoveryPanel } from "./RecoveryPanel";
import { Actions } from "./Actions";

export function ReceiptPageView({ receipt }: { receipt: ChangeReceipt }) {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">Change Receipt</p>
        <h1 className="text-3xl font-bold">{receipt.change.commitSubject ?? receipt.change.shortSha}</h1>
        <p className="font-mono text-sm text-slate-300">{receipt.change.commitSha}</p>
        <p className="text-sm text-emerald-300">AI link: {receipt.change.aiLinkStatus}</p>
      </header>
      <EvidenceTimeline receipt={receipt} />
      <CiSection receipt={receipt} />
      <ImpactCards receipt={receipt} />
      <RecoveryPanel receipt={receipt} />
      <Actions receipt={receipt} />
      <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-100">
        {receipt.caveat}
      </p>
    </main>
  );
}
