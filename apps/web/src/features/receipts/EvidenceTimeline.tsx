import type { ChangeReceipt } from "@greenlight/shared";

const stages = ["Claude", "Commit", "CI", "Deploy", "Impact", "Recovery"] as const;

export function EvidenceTimeline({ receipt }: { receipt: ChangeReceipt }) {
  return (
    <section aria-label="Evidence timeline" className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-4 text-xl font-semibold">Timeline</h2>
      <ol className="grid gap-3 md:grid-cols-3">
        {stages.map((stage) => (
          <li key={stage} className="rounded-lg bg-slate-950 p-3 text-sm">
            <p className="font-medium">{stage}</p>
            <p className="text-slate-400">
              {stage === "Claude" && receipt.change.aiVerificationState}
              {stage === "Commit" && receipt.change.shortSha}
              {stage === "CI" && (receipt.pipeline?.exportState ?? "missing")}
              {stage === "Deploy" && (receipt.deployment?.versionState ?? "none")}
              {stage === "Impact" && (receipt.impact?.status ?? "none")}
              {stage === "Recovery" && (receipt.recovery?.status ?? "none")}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
