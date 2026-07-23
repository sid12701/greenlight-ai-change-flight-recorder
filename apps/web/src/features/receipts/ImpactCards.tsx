import type { ChangeReceipt } from "@greenlight/shared";

export function ImpactCards({ receipt }: { receipt: ChangeReceipt }) {
  if (!receipt.impact) {
    return <section><p>Insufficient data for impact comparison.</p></section>;
  }

  const hideErrorHeadline =
    receipt.impact.status === "regressed" &&
    receipt.impact.baselineErrorRate === receipt.impact.observedErrorRate;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-xl font-semibold">Impact</h2>
      <p className="text-sm text-slate-400">Route {receipt.impact.route}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <article className="rounded-lg bg-slate-950 p-4">
          <h3 className="font-medium">p95</h3>
          <p>{receipt.impact.baselineP95Ms} ms → {receipt.impact.observedP95Ms} ms</p>
        </article>
        {!hideErrorHeadline ? (
          <article className="rounded-lg bg-slate-950 p-4">
            <h3 className="font-medium">Error rate</h3>
            <p>{receipt.impact.baselineErrorRate}% → {receipt.impact.observedErrorRate}%</p>
          </article>
        ) : null}
        <article className="rounded-lg bg-slate-950 p-4">
          <h3 className="font-medium">Samples</h3>
          <p>{receipt.impact.baselineRequestCount} / {receipt.impact.observedRequestCount}</p>
        </article>
      </div>
      <ul className="mt-4 list-disc pl-5 text-sm text-slate-300">
        {receipt.impact.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </section>
  );
}
