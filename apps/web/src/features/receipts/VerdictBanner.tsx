import type { ChangeReceipt } from "@greenlight/shared";
import { formatMilliseconds, formatPercent } from "../../formatters";
import { percentChange, regressionPresentation, TONE_CLASS } from "../../status";

/**
 * Reads the change in a metric the way a reader would say it out loud.
 *
 * "n/a" on its own tells a reader nothing about why; distinguishing a missing
 * measurement from an unchanged one matters when the verdict rests on it.
 */
function Delta({
  label,
  baseline,
  observed,
  format,
}: {
  label: string;
  baseline: number | null;
  observed: number | null;
  format: (value: number | null) => string;
}) {
  const change = percentChange(baseline, observed);
  const unavailable = baseline === null || observed === null;

  return (
    <div>
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">
        {unavailable ? (
          <span className="text-slate-400">not measured</span>
        ) : (
          <>
            <span className="text-slate-400">{format(baseline)}</span>
            <span aria-label="changed to" className="px-2 text-slate-500">
              →
            </span>
            <span>{format(observed)}</span>
            {change === null ? null : (
              <span
                className={`ml-2 text-sm font-medium ${
                  change > 0 ? "text-red-300" : "text-emerald-300"
                }`}
              >
                {change > 0 ? "+" : ""}
                {change.toFixed(change >= 100 || change <= -100 ? 0 : 1)}%
              </span>
            )}
          </>
        )}
      </dd>
    </div>
  );
}

/**
 * The verdict, first and largest.
 *
 * A reader who stops after this block should already know whether the change
 * was safe, what moved, and what was done about it. Everything below it is
 * supporting evidence for that sentence.
 */
export function VerdictBanner({ receipt }: { receipt: ChangeReceipt }) {
  const status = receipt.impact?.status ?? null;
  const presentation = regressionPresentation(status);
  const recovered = status === "recovered" || receipt.recovery !== null;

  return (
    <section
      aria-labelledby="verdict-heading"
      className={`rounded-xl p-6 ${TONE_CLASS[presentation.tone]}`}
    >
      <p className="text-sm uppercase tracking-wide opacity-80">Verdict</p>
      <h2 id="verdict-heading" className="mt-1 text-4xl font-bold">
        {presentation.label}
      </h2>
      <p className="mt-2 max-w-2xl text-sm opacity-90">{presentation.meaning}</p>

      {receipt.impact ? (
        <>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Delta
              baseline={receipt.impact.baselineP95Ms}
              format={formatMilliseconds}
              label="Latency p95"
              observed={receipt.impact.observedP95Ms}
            />
            <Delta
              baseline={receipt.impact.baselineErrorRate}
              format={formatPercent}
              label="Error rate"
              observed={receipt.impact.observedErrorRate}
            />
          </dl>
          <p className="mt-4 text-sm opacity-80">
            Route <span className="font-mono">{receipt.impact.route}</span>
            {recovered && receipt.recovery
              ? ` · recovered by deployment ${receipt.recovery.deploymentId}`
              : null}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm opacity-80">
          Deploy this change and run an evaluation to produce a verdict.
        </p>
      )}
    </section>
  );
}
