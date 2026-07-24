import type { ChangeReceipt } from "@greenlight/shared";
import {
  formatCount,
  formatDateTime,
  formatMilliseconds,
  formatPercent,
} from "../../formatters";

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  healthy: { label: "Healthy", className: "bg-emerald-950/40 text-emerald-300" },
  regressed: { label: "Regressed", className: "bg-red-950/40 text-red-300" },
  recovered: { label: "Recovered", className: "bg-emerald-950/40 text-emerald-300" },
  insufficient_data: { label: "Insufficient data", className: "bg-amber-950/40 text-amber-300" },
  integration_error: { label: "Integration error", className: "bg-red-950/40 text-red-300" },
};

export function ImpactCards({ receipt }: { receipt: ChangeReceipt }) {
  // No evaluation has been produced yet. This is distinct from the
  // `insufficient_data` verdict, which means an evaluation ran and found too
  // little traffic to decide.
  if (!receipt.impact) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-xl font-semibold">Impact</h2>
        <p className="mt-2 text-sm text-slate-400">
          No impact evaluation has been recorded for this change yet.
        </p>
      </section>
    );
  }
  if (receipt.impact.status === "integration_error") {
    return (
      <section role="alert" className="rounded-xl border border-red-900/50 bg-red-950/30 p-4">
        <h2 className="text-xl font-semibold">Impact unavailable</h2>
        <p className="mt-2 text-sm">
          SigNoz could not provide verified metrics for the persisted window, so no
          verdict was reached. This is a dependency failure, not a healthy result.
        </p>
      </section>
    );
  }

  const status = STATUS_STYLE[receipt.impact.status ?? "unknown"] ??
    { label: receipt.impact.status ?? "unknown", className: "bg-slate-800 text-slate-200" };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">Impact</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>
      <p className="text-sm text-slate-400">Route {receipt.impact.route}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <article className="rounded-lg bg-slate-950 p-4">
          <h3 className="font-medium">p95</h3>
          <p>{formatMilliseconds(receipt.impact.baselineP95Ms)} → {formatMilliseconds(receipt.impact.observedP95Ms)}</p>
        </article>
        <article className="rounded-lg bg-slate-950 p-4">
          <h3 className="font-medium">Error rate</h3>
          <p>{formatPercent(receipt.impact.baselineErrorRate)} → {formatPercent(receipt.impact.observedErrorRate)}</p>
        </article>
        <article className="rounded-lg bg-slate-950 p-4">
          <h3 className="font-medium">Samples</h3>
          <p>{formatCount(receipt.impact.baselineRequestCount)} / {formatCount(receipt.impact.observedRequestCount)}</p>
        </article>
      </div>
      <ul className="mt-4 list-disc pl-5 text-sm text-slate-300">
        {receipt.impact.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <dl className="mt-4 grid gap-2 border-t border-slate-800 pt-4 text-sm md:grid-cols-2">
        <div>
          <dt className="text-slate-400">Baseline window</dt>
          <dd>{formatDateTime(receipt.impact.baselineWindow.start)} – {formatDateTime(receipt.impact.baselineWindow.end)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Observed window</dt>
          <dd>{formatDateTime(receipt.impact.observedWindow.start)} – {formatDateTime(receipt.impact.observedWindow.end)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Applied policy</dt>
          <dd>
            {receipt.impact.policyVersion}; min {formatCount(receipt.impact.thresholds.minSpans)} spans;
            p95 &gt; {receipt.impact.thresholds.latencyMultiplier}× and +{formatMilliseconds(receipt.impact.thresholds.latencyAdditiveMs)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
