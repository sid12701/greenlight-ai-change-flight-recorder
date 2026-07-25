import type { ChangeReceipt } from "@greenlight/shared";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  GitBranch,
  RadioTower,
  Workflow,
} from "lucide-react";
import { formatMilliseconds } from "../../formatters";

export function CiSection({ receipt }: { receipt: ChangeReceipt }) {
  if (!receipt.pipeline) {
    return (
      <section className="receipt-section">
        <p>No primary CI run synced yet.</p>
      </section>
    );
  }

  return (
    <section className="receipt-section ci-section">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">GitHub Actions evidence</p>
          <h2>Primary CI (reconstructed)</h2>
        </div>
        <span className="health-orb health-orb--good">
          <CheckCircle2 size={16} aria-hidden="true" />
          {receipt.pipeline.conclusion ?? receipt.pipeline.status}
        </span>
      </div>
      <p className="section-description">
        Reconstructed from GitHub REST API timing, not native runner telemetry.
      </p>
      <dl className="fact-grid">
        <div>
          <dt><Workflow size={15} aria-hidden="true" /> Workflow</dt>
          <dd>{receipt.pipeline.workflowName}</dd>
        </div>
        <div>
          <dt><CheckCircle2 size={15} aria-hidden="true" /> Conclusion</dt>
          <dd>{receipt.pipeline.conclusion ?? receipt.pipeline.status}</dd>
        </div>
        <div>
          <dt><GitBranch size={15} aria-hidden="true" /> Slowest step</dt>
          <dd>{receipt.pipeline.slowestStep ?? "n/a"}</dd>
        </div>
        <div>
          <dt><Clock3 size={15} aria-hidden="true" /> Duration</dt>
          <dd>{formatMilliseconds(receipt.pipeline.durationMs)}</dd>
        </div>
        <div>
          <dt><RadioTower size={15} aria-hidden="true" /> Export evidence</dt>
          <dd>{receipt.pipeline.exportState}</dd>
        </div>
      </dl>
      <div className="evidence-actions">
        <a className="secondary-cta secondary-cta--compact" href={receipt.pipeline.htmlUrl}>
          GitHub run <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        {receipt.pipeline.signozTraceUrl ? (
          <a className="secondary-cta secondary-cta--compact" href={receipt.pipeline.signozTraceUrl}>
            SigNoz trace <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        ) : null}
      </div>
      {receipt.pipeline.exportState !== "verified" ? (
        <p className="inline-alert">
          The CI trace link is withheld until SigNoz verifies the reconstructed span tree.
        </p>
      ) : null}
      {receipt.relatedPipelines.length ? (
        <div className="related-workflows">
          <h3>Related workflows</h3>
          <ul>
            {receipt.relatedPipelines.map((pipeline) => (
              <li key={pipeline.htmlUrl}>
                <a href={pipeline.htmlUrl}>{pipeline.workflowName} <ArrowUpRight size={14} /></a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
