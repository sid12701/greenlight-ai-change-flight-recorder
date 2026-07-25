import type { ChangeReceipt } from "@greenlight/shared";
import { EvidenceTimeline } from "./EvidenceTimeline";
import { CiSection } from "./CiSection";
import { ImpactCards } from "./ImpactCards";
import { RecoveryPanel } from "./RecoveryPanel";
import { Actions } from "./Actions";
import { VerdictBanner } from "./VerdictBanner";
import { formatDateTime } from "../../formatters";
import { verificationPresentation } from "../../status";

/**
 * Colour must follow the evidence state.
 *
 * Rendering "missing" or "invalid" in the success colour tells a reader the
 * opposite of what the receipt says, which is the one thing an evidence
 * product must never do.
 */
function verificationTone(state: string): string {
  switch (state) {
    case "verified":
      return "text-emerald-300";
    case "unverified":
    case "pending":
      return "text-amber-300";
    case "missing":
    case "invalid":
    case "failed":
      return "text-red-300";
    default:
      return "text-slate-300";
  }
}

export function ReceiptPageView({ receipt }: { receipt: ChangeReceipt }) {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-2">
        <a className="text-sm text-slate-400 underline underline-offset-4" href="/changes">
          ← All changes
        </a>
        <p className="text-sm uppercase tracking-wide text-slate-400">Change Receipt</p>
        <h1 className="text-3xl font-bold">{receipt.change.commitSubject ?? receipt.change.shortSha}</h1>
        <p className="break-all font-mono text-sm text-slate-300">{receipt.change.commitSha}</p>
        <p className={`text-sm ${verificationTone(receipt.change.aiVerificationState)}`}>
          AI link: {receipt.change.aiLinkStatus} (
          {verificationPresentation(receipt.change.aiVerificationState).meaning})
        </p>
      </header>
      {/* The decision comes before the evidence for it: a reader who stops
          here still knows whether the change was safe and what moved. */}
      <VerdictBanner receipt={receipt} />
      <RecoveryPanel receipt={receipt} />
      <ImpactCards receipt={receipt} />
      <EvidenceTimeline receipt={receipt} />
      <CiSection receipt={receipt} />
      {receipt.deployment ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-xl font-semibold">Deployment</h2>
          <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <div>
              <dt className="text-slate-400">Version</dt>
              <dd className="break-all font-mono">
                {receipt.deployment.version ?? "unresolved"}
              </dd>
            </div>
            <div><dt className="text-slate-400">Image digest</dt><dd className="break-all font-mono">{receipt.deployment.imageDigest ?? "unrecorded"}</dd></div>
            <div>
              <dt className="text-slate-400">Version evidence</dt>
              <dd className={verificationTone(receipt.deployment.versionState)}>
                {receipt.deployment.versionState}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Trace evidence</dt>
              <dd className={verificationTone(receipt.deployment.traceState)}>
                {receipt.deployment.traceState}
              </dd>
            </div>
            <div><dt className="text-slate-400">Role</dt><dd>{receipt.deployment.role}</dd></div>
            <div><dt className="text-slate-400">Ready at</dt><dd>{formatDateTime(receipt.deployment.deployedAt)}</dd></div>
          </dl>
        </section>
      ) : null}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-xl font-semibold">Evidence</h2>
        {receipt.evidence.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {receipt.evidence.map((item) => (
              <li key={`${item.kind}-${item.label}`}>
                {item.verificationState === "verified" ? (
                  <a className="underline" href={item.url}>{item.label}</a>
                ) : (
                  <span className={verificationTone(item.verificationState)}>
                    {item.label} ({item.verificationState}; link withheld)
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-slate-400">No verified evidence links.</p>}
      </section>
      <Actions receipt={receipt} />
      <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-100">
        {receipt.caveat}
      </p>
    </main>
  );
}
