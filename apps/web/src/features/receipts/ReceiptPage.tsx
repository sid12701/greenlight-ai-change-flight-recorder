import type { ChangeReceipt, ReceiptEvidenceLink } from "@greenlight/shared";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Bot,
  Box,
  CalendarClock,
  ChevronDown,
  CircleGauge,
  Fingerprint,
  Layers3,
  RadioTower,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { formatDateTime } from "../../formatters";
import { verificationPresentation } from "../../status";
import { Actions } from "./Actions";
import { CiSection } from "./CiSection";
import { EvidenceFreshness } from "./EvidenceFreshness";
import { EvidenceTimeline } from "./EvidenceTimeline";
import { ImpactCards } from "./ImpactCards";
import { RecoveryPanel } from "./RecoveryPanel";
import { VerdictBanner } from "./VerdictBanner";

function verificationTone(state: string): string {
  switch (state) {
    case "verified":
      return "verification-text verification-text--good text-emerald";
    case "unverified":
    case "pending":
    case "missing":
      return "verification-text verification-text--warn text-amber";
    case "invalid":
    case "failed":
      return "verification-text verification-text--bad text-red";
    default:
      return "verification-text text-slate";
  }
}

const EVIDENCE_ICON: Record<ReceiptEvidenceLink["kind"], LucideIcon> = {
  ai_trace: Bot,
  github_run: Workflow,
  deployment_trace: Box,
  signoz_trace: RadioTower,
  signoz_dashboard: CircleGauge,
};

function DeploymentSection({ receipt }: { receipt: ChangeReceipt }) {
  if (!receipt.deployment) {
    return null;
  }

  return (
    <section className="receipt-section deployment-section">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">Immutable runtime identity</p>
          <h2>Deployment</h2>
        </div>
        <span className="health-orb health-orb--good">
          <ShieldCheck size={16} aria-hidden="true" />
          Version verified
        </span>
      </div>
      <dl className="fact-grid fact-grid--deployment">
        <div>
          <dt><Fingerprint size={15} aria-hidden="true" /> Version</dt>
          <dd><code>{receipt.deployment.version ?? "unresolved"}</code></dd>
        </div>
        <div>
          <dt><Box size={15} aria-hidden="true" /> Image digest</dt>
          <dd><code>{receipt.deployment.imageDigest ?? "unrecorded"}</code></dd>
        </div>
        <div>
          <dt><ShieldCheck size={15} aria-hidden="true" /> Version evidence</dt>
          <dd className={verificationTone(receipt.deployment.versionState)}>
            {receipt.deployment.versionState}
          </dd>
        </div>
        <div>
          <dt><RadioTower size={15} aria-hidden="true" /> Trace evidence</dt>
          <dd className={verificationTone(receipt.deployment.traceState)}>
            {receipt.deployment.traceState}
          </dd>
        </div>
        <div>
          <dt><Layers3 size={15} aria-hidden="true" /> Role</dt>
          <dd>{receipt.deployment.role}</dd>
        </div>
        <div>
          <dt><CalendarClock size={15} aria-hidden="true" /> Ready at</dt>
          <dd>{formatDateTime(receipt.deployment.deployedAt)}</dd>
        </div>
      </dl>
      {receipt.deployment.imageDigest &&
        receipt.recovery?.imageDigest === receipt.deployment.imageDigest ? (
          <p className="evidence-note">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              Recovery carries the same image digest: the runtime artifact did not
              change. The configuration-only difference is identified by{" "}
              <code>service.version</code>.
            </span>
          </p>
        ) : null}
    </section>
  );
}

function EvidenceLinks({ evidence }: { evidence: ReceiptEvidenceLink[] }) {
  return (
    <section className="receipt-section evidence-links-section">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">Resolvable proof</p>
          <h2>Evidence links</h2>
        </div>
        <span className="timeline-count">
          {evidence.filter((item) => item.verificationState === "verified").length} verified
        </span>
      </div>
      {evidence.length ? (
        <ul className="evidence-link-list">
          {evidence.map((item) => {
            const Icon = EVIDENCE_ICON[item.kind];
            return (
              <li key={`${item.kind}-${item.label}`}>
                <span className="evidence-link-icon" aria-hidden="true"><Icon size={17} /></span>
                <div>
                  {item.verificationState === "verified" ? (
                    <a href={item.url}>
                      {item.label}
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </a>
                  ) : (
                    <span className={verificationTone(item.verificationState)}>
                      {item.label} ({item.verificationState}; link withheld)
                    </span>
                  )}
                  <small>{item.kind.replaceAll("_", " ")}</small>
                </div>
                <span className={`evidence-state evidence-state--${item.verificationState}`}>
                  {item.verificationState}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="section-description">No verified evidence links.</p>
      )}
    </section>
  );
}

export function ReceiptPageView({ receipt }: { receipt: ChangeReceipt }) {
  const aiPresentation = verificationPresentation(receipt.change.aiVerificationState);

  return (
    <>
      <AppHeader active="receipt" />
      <main className="app-page receipt-page">
        <header className="receipt-header">
          <div className="receipt-header-main">
            <p className="eyebrow">
              <Fingerprint size={15} aria-hidden="true" />
              Change receipt · immutable evidence
            </p>
            <h1>{receipt.change.commitSubject ?? receipt.change.shortSha}</h1>
            <div className="receipt-identity">
              <code>{receipt.change.commitSha}</code>
              <span>{receipt.change.branch ?? "branch not recorded"}</span>
              {receipt.change.committedAt ? (
                <time dateTime={receipt.change.committedAt}>
                  {formatDateTime(receipt.change.committedAt)}
                </time>
              ) : null}
            </div>
            <p className={verificationTone(receipt.change.aiVerificationState)}>
              AI link: {aiPresentation.label.toLowerCase()} ({aiPresentation.meaning})
            </p>
          </div>
          <a className="secondary-cta secondary-cta--compact" href={receipt.change.githubUrl}>
            Open commit <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </header>

        <VerdictBanner receipt={receipt} />
        <EvidenceFreshness receipt={receipt} />
        <RecoveryPanel receipt={receipt} />
        <ImpactCards receipt={receipt} />

        <details className="evidence-disclosure" open>
          <summary>
            <span>
              <RadioTower size={18} aria-hidden="true" />
              <strong>Evidence behind this verdict</strong>
              <small>timeline, CI, deployment, and source links</small>
            </span>
            <ChevronDown size={19} aria-hidden="true" />
          </summary>
          <div className="evidence-detail-stack">
            <EvidenceTimeline receipt={receipt} />
            <div className="receipt-two-column">
              <CiSection receipt={receipt} />
              <DeploymentSection receipt={receipt} />
            </div>
            <EvidenceLinks evidence={receipt.evidence} />
          </div>
        </details>

        <Actions receipt={receipt} />

        <aside className="trust-caveat">
          <ShieldCheck size={21} aria-hidden="true" />
          <div>
            <strong>Evidence boundary</strong>
            <p>{receipt.caveat}</p>
          </div>
        </aside>
      </main>
    </>
  );
}
