import type { ChangeReceipt } from "@greenlight/shared";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { formatMilliseconds, formatPercent } from "../../formatters";
import { percentChange, regressionPresentation } from "../../status";

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
    <div className="verdict-delta">
      <dt>{label}</dt>
      <dd>
        {unavailable ? (
          <span className="muted-value">not measured</span>
        ) : (
          <>
            <span>{format(baseline)}</span>
            <ArrowRight size={17} aria-label="changed to" />
            <strong>{format(observed)}</strong>
            {change === null ? null : (
              <em className={change > 0 ? "delta-up" : "delta-down"}>
                {change > 0 ? "+" : ""}
                {change.toFixed(Math.abs(change) >= 100 ? 0 : 1)}%
              </em>
            )}
          </>
        )}
      </dd>
    </div>
  );
}

export function VerdictBanner({ receipt }: { receipt: ChangeReceipt }) {
  const status = receipt.impact?.status ?? null;
  const presentation = regressionPresentation(status);
  const recovered = status === "recovered" || receipt.recovery !== null;
  const multiplier = receipt.impact?.baselineP95Ms && receipt.impact.observedP95Ms
    ? receipt.impact.observedP95Ms / receipt.impact.baselineP95Ms
    : null;
  const Icon = presentation.tone === "bad" ? ShieldAlert : CheckCircle2;

  return (
    <section
      aria-labelledby="verdict-heading"
      className={`verdict-hero verdict-hero--${presentation.tone}`}
    >
      <div className="verdict-overline">
        <span>
          <Icon size={17} aria-hidden="true" />
          Production verdict
        </span>
        <code>{receipt.change.shortSha}</code>
      </div>

      <div className="verdict-grid">
        <div className="verdict-copy">
          <h2 id="verdict-heading">{presentation.label}</h2>
          <p>{presentation.meaning}</p>
          {receipt.impact ? (
            <span className="route-pill">
              <Activity size={15} aria-hidden="true" />
              Route {receipt.impact.route}
            </span>
          ) : null}
        </div>

        {multiplier ? (
          <div className="verdict-headline-metric">
            <span>Latency shift</span>
            <strong>{multiplier.toFixed(1)}×</strong>
            <small>p95 after deployment</small>
          </div>
        ) : null}
      </div>

      {receipt.impact ? (
        <dl className="verdict-deltas">
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
          <div className="verdict-delta">
            <dt>Recovery</dt>
            <dd>
              <strong>{recovered ? "Verified" : "Pending"}</strong>
              {recovered && receipt.recovery ? (
                <span className="verdict-recovery-sha">
                  {receipt.recovery.version?.slice(0, 7) ?? "recorded"}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="verdict-empty">
          Deploy this change and run an evaluation to produce a verdict.
        </p>
      )}
    </section>
  );
}
