import type { ChangeReceipt } from "@greenlight/shared";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Gauge,
  Info,
  Layers3,
  SlidersHorizontal,
} from "lucide-react";
import {
  formatCount,
  formatDateTime,
  formatMilliseconds,
  formatPercent,
} from "../../formatters";

const STATUS_LABEL: Record<string, string> = {
  healthy: "Healthy",
  regressed: "Regressed",
  recovered: "Recovered",
  insufficient_data: "Insufficient data",
  integration_error: "Integration error",
};

function MetricCard({
  icon: Icon,
  label,
  baseline,
  observed,
  tone = "neutral",
}: {
  icon: typeof Gauge;
  label: string;
  baseline: string;
  observed: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <article className={`impact-metric impact-metric--${tone}`}>
      <div className="impact-metric-label">
        <Icon size={17} aria-hidden="true" />
        <h3>{label}</h3>
      </div>
      <div className="impact-metric-values">
        <span><small>Baseline</small>{baseline}</span>
        <span><small>Observed</small><strong>{observed}</strong></span>
      </div>
    </article>
  );
}

export function ImpactCards({ receipt }: { receipt: ChangeReceipt }) {
  if (!receipt.impact) {
    return (
      <section className="receipt-section empty-impact">
        <div className="section-icon"><Activity size={20} aria-hidden="true" /></div>
        <div>
          <p className="section-kicker">Production signal</p>
          <h2>Impact</h2>
          <p>No impact evaluation has been recorded for this change yet.</p>
        </div>
      </section>
    );
  }

  if (receipt.impact.status === "integration_error") {
    return (
      <section role="alert" className="receipt-section receipt-section--danger">
        <AlertTriangle size={22} aria-hidden="true" />
        <div>
          <h2>Impact unavailable</h2>
          <p>
            SigNoz could not provide verified metrics for the persisted window, so no
            verdict was reached. This is a dependency failure, not a healthy result.
          </p>
        </div>
      </section>
    );
  }

  const status = receipt.impact.status ?? "unknown";
  const baselineP95 = receipt.impact.baselineP95Ms;
  const observedP95 = receipt.impact.observedP95Ms;
  const chartMax = Math.max(baselineP95 ?? 0, observedP95 ?? 0, 1);
  const baselineWidth = ((baselineP95 ?? 0) / chartMax) * 100;
  const observedWidth = ((observedP95 ?? 0) / chartMax) * 100;

  return (
    <section className="receipt-section impact-section" aria-labelledby="impact-heading">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">Measured production impact · before and after</p>
          <h2 id="impact-heading">Impact</h2>
        </div>
        <span className={`status-chip status-chip--${status === "regressed" ? "bad" : "good"}`}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      <div className="impact-layout">
        <figure
          className="latency-figure"
          aria-label={`Latency p95 changed from ${formatMilliseconds(baselineP95)} to ${formatMilliseconds(observedP95)}`}
        >
          <figcaption>
            <span>p95 latency comparison</span>
            <code>{receipt.impact.route}</code>
          </figcaption>
          <div className="comparison-row">
            <span>Baseline</span>
            <div className="comparison-track">
              <div className="comparison-fill comparison-fill--baseline" style={{ width: `${baselineWidth}%` }} />
            </div>
            <strong>{formatMilliseconds(baselineP95)}</strong>
          </div>
          <div className="comparison-row">
            <span>Observed</span>
            <div className="comparison-track">
              <div className="comparison-fill comparison-fill--observed" style={{ width: `${observedWidth}%` }} />
            </div>
            <strong>{formatMilliseconds(observedP95)}</strong>
          </div>
          <p className="chart-insight">
            <AlertTriangle size={15} aria-hidden="true" />
            {receipt.impact.reasons.join(" · ")}
          </p>
        </figure>

        <div className="impact-metric-grid">
          <MetricCard
            icon={Gauge}
            label="p95"
            baseline={formatMilliseconds(baselineP95)}
            observed={formatMilliseconds(observedP95)}
            tone={status === "regressed" ? "danger" : "neutral"}
          />
          <MetricCard
            icon={Activity}
            label="Error rate"
            baseline={formatPercent(receipt.impact.baselineErrorRate)}
            observed={formatPercent(receipt.impact.observedErrorRate)}
          />
          <MetricCard
            icon={Layers3}
            label="Samples"
            baseline={formatCount(receipt.impact.baselineRequestCount)}
            observed={formatCount(receipt.impact.observedRequestCount)}
          />
        </div>
      </div>

      <dl className="evidence-facts">
        <div>
          <dt><Clock3 size={15} aria-hidden="true" /> Baseline window</dt>
          <dd>{formatDateTime(receipt.impact.baselineWindow.start)} – {formatDateTime(receipt.impact.baselineWindow.end)}</dd>
        </div>
        <div>
          <dt><Clock3 size={15} aria-hidden="true" /> Observed window</dt>
          <dd>{formatDateTime(receipt.impact.observedWindow.start)} – {formatDateTime(receipt.impact.observedWindow.end)}</dd>
        </div>
        <div>
          <dt><SlidersHorizontal size={15} aria-hidden="true" /> Applied policy</dt>
          <dd>
            {receipt.impact.policyVersion}; min {formatCount(receipt.impact.thresholds.minSpans)} spans;
            p95 &gt; {receipt.impact.thresholds.latencyMultiplier}× and +{formatMilliseconds(receipt.impact.thresholds.latencyAdditiveMs)}
          </dd>
        </div>
      </dl>

      <p className="evidence-note">
        <Info size={16} aria-hidden="true" />
        <span>
          The baseline is the frozen last-known-good deployment{" "}
          <code>{receipt.impact.baselineVersion?.slice(0, 7) ?? "unresolved"}</code>.
          The comparison is scoped to immutable <code>service.version</code>, not
          elapsed wall-clock time.
        </span>
      </p>
    </section>
  );
}
