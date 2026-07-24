import type { ChangeReceipt } from "@greenlight/shared";
import { formatMilliseconds } from "../../formatters";

export function CiSection({ receipt }: { receipt: ChangeReceipt }) {
  if (!receipt.pipeline) {
    return <section><p>No primary CI run synced yet.</p></section>;
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-xl font-semibold">Primary CI (reconstructed)</h2>
      <p className="text-sm text-amber-200">Reconstructed from GitHub REST API timing, not native runner telemetry.</p>
      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <div><dt className="text-slate-400">Workflow</dt><dd>{receipt.pipeline.workflowName}</dd></div>
        <div><dt className="text-slate-400">Conclusion</dt><dd>{receipt.pipeline.conclusion ?? receipt.pipeline.status}</dd></div>
        <div><dt className="text-slate-400">Slowest step</dt><dd>{receipt.pipeline.slowestStep ?? "n/a"}</dd></div>
        <div><dt className="text-slate-400">Duration</dt><dd>{formatMilliseconds(receipt.pipeline.durationMs)}</dd></div>
        <div><dt className="text-slate-400">Export evidence</dt><dd>{receipt.pipeline.exportState}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-3">
        <a className="underline" href={receipt.pipeline.htmlUrl}>GitHub run</a>
        {receipt.pipeline.signozTraceUrl ? (
          <a className="underline" href={receipt.pipeline.signozTraceUrl}>SigNoz trace</a>
        ) : null}
      </div>
      {receipt.pipeline.exportState !== "verified" ? (
        <p className="mt-3 text-sm text-amber-200">
          The CI trace link is withheld until SigNoz verifies the reconstructed span tree.
        </p>
      ) : null}
      {receipt.relatedPipelines.length ? (
        <div className="mt-4">
          <h3 className="font-medium">Related workflows</h3>
          <ul className="list-disc pl-5 text-sm">
            {receipt.relatedPipelines.map((pipeline) => (
              <li key={pipeline.htmlUrl}>
                <a className="underline" href={pipeline.htmlUrl}>{pipeline.workflowName}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
