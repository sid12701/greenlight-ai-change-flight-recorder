import type { ChangeSummary, DependencyState, DependencyStatus } from "@greenlight/shared";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  CircleDashed,
  Database,
  ExternalLink,
  Gauge,
  GitBranch,
  GitPullRequestArrow,
  RadioTower,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { formatDateTime, formatRelativeTime } from "../../formatters";
import { regressionPresentation } from "../../status";
import { evidenceLinks, selectFeaturedChange } from "./featured";

export type LandingState = "loading" | "ready" | "unreachable";

const DEPENDENCY_META: Record<
  keyof DependencyStatus["checks"],
  { label: string; icon: LucideIcon }
> = {
  database: { label: "Database", icon: Database },
  github: { label: "GitHub", icon: GitBranch },
  signoz: { label: "SigNoz", icon: RadioTower },
};

const DEPENDENCY_REMEDIES: Record<keyof DependencyStatus["checks"], string> = {
  database: "npm run demo:up",
  github: "Check GITHUB_REPOSITORY and GITHUB_TOKEN in .env.demo",
  signoz: "npm run demo:up  # restarts the pinned SigNoz stack",
};

const EVIDENCE_ICONS = {
  ai: Bot,
  ci: Workflow,
  deployment: GitPullRequestArrow,
  verdict: Gauge,
} satisfies Record<ReturnType<typeof evidenceLinks>[number]["key"], LucideIcon>;

function DependencyRow({
  name,
  state,
}: {
  name: keyof DependencyStatus["checks"];
  state: DependencyState;
}) {
  const { icon: Icon, label } = DEPENDENCY_META[name];
  return (
    <div className="dependency-row">
      <span className="dependency-name">
        <Icon size={17} aria-hidden="true" />
        {label}
      </span>
      <span className={`dependency-state dependency-state--${state}`}>
        <span className="status-dot" aria-hidden="true" />
        {state === "ok" ? "healthy" : "degraded"}
      </span>
      {state === "degraded" ? (
        <code className="remedy-code">{DEPENDENCY_REMEDIES[name]}</code>
      ) : null}
    </div>
  );
}

function Readiness({
  status,
  checkedAt,
}: {
  status: DependencyStatus | null;
  checkedAt: string | null;
}) {
  const healthy = status?.status === "ok";
  return (
    <section aria-labelledby="readiness-heading" className="surface-card readiness-card">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">Live system</p>
          <h2 id="readiness-heading">Stack readiness</h2>
        </div>
        <span className={`health-orb health-orb--${healthy ? "good" : "bad"}`}>
          {healthy ? <Check size={17} aria-hidden="true" /> : <TriangleAlert size={17} aria-hidden="true" />}
          {healthy ? "All systems ready" : "Needs attention"}
        </span>
      </div>

      {status === null ? (
        <div role="alert" className="inline-alert inline-alert--danger">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>
            The GreenLight API could not be reached. Start the stack with{" "}
            <code>npm run demo:up</code>.
          </span>
        </div>
      ) : (
        <div className="dependency-list">
          {(Object.keys(DEPENDENCY_META) as Array<keyof DependencyStatus["checks"]>).map(
            (name) => <DependencyRow key={name} name={name} state={status.checks[name]} />,
          )}
        </div>
      )}

      {checkedAt ? (
        <p className="freshness-note">
          Checked <time dateTime={checkedAt}>{formatRelativeTime(checkedAt)}</time>
          {" · "}
          {formatDateTime(checkedAt)}
        </p>
      ) : null}
    </section>
  );
}

function EvidenceChain({ change }: { change: ChangeSummary }) {
  const links = evidenceLinks(change);
  const resolved = links.filter((link) => link.resolved).length;

  return (
    <div className="evidence-chain" aria-label={`${resolved} of ${links.length} evidence links resolve`}>
      <div className="evidence-chain-header">
        <span>Evidence chain</span>
        <span className="sr-only">{resolved} of {links.length} links resolve</span>
        <strong>{resolved}/{links.length} resolved</strong>
      </div>
      <ol className="evidence-chain-list">
        {links.map((link, index) => {
          const Icon = EVIDENCE_ICONS[link.key];
          return (
            <li className={link.resolved ? "is-resolved" : "is-pending"} key={link.key}>
              <span className="chain-index">0{index + 1}</span>
              <span className="chain-icon" aria-hidden="true">
                <Icon size={17} />
              </span>
              <span className="chain-copy">
                <strong>{link.label}</strong>
                <small>{link.resolved ? "Verified" : "Not linked"}</small>
                <span className="sr-only">
                  {link.resolved ? "resolved" : "not linked"} — {link.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="chain-disclosure">
        Missing links stay visible. GreenLight never turns absent evidence into a pass.
      </p>
    </div>
  );
}

function RecordedIncident({ changes }: { changes: ChangeSummary[] }) {
  const featured = selectFeaturedChange(changes);

  return (
    <section className="incident-panel" aria-labelledby="recorded-incident-heading">
      <div className="incident-topline">
        <span className="live-label">
          <span className="live-dot" aria-hidden="true" />
          Recorded incident
        </span>
        <span className="mono-label">/balances</span>
      </div>

      {/* Deliberately no latency numbers here. The change list this panel reads
          from carries verdicts, not measurements, so any figure printed at this
          level would be a constant typed into the markup — which is precisely
          the thing this product exists to catch. The measured deltas live on
          the receipt, one click away, where they come from SigNoz. */}
      <div className="incident-verdict">
        <span className="metric-label">Verdict</span>
        <strong>
          {featured ? regressionPresentation(featured.regressionStatus).label : "None recorded"}
        </strong>
        <span className="metric-caption">
          {featured
            ? regressionPresentation(featured.regressionStatus).meaning
            : "Run a chain to record one"}
        </span>
      </div>

      {featured ? (
        <>
          <EvidenceChain change={featured} />
          <a className="primary-cta primary-cta--danger" href={`/changes/${featured.commitSha}`}>
            Open the verified receipt
            <ArrowRight size={18} aria-hidden="true" />
          </a>
          <p className="incident-commit">
            <span>{featured.commitSubject ?? featured.shortSha}</span>
            <code>{featured.shortSha}</code>
          </p>
        </>
      ) : (
        <div className="incident-empty">
          <p>
            {changes.length === 0
              ? "No changes have been recorded yet."
              : `${changes.length} change(s) exist, but none has a measured deployment verdict.`}
          </p>
          <code>node scripts/demo-chain.mjs &lt;baseline&gt; &lt;candidate&gt; &lt;recovery&gt;</code>
        </div>
      )}
    </section>
  );
}

function LoadingLanding() {
  return (
    <>
      <AppHeader active="overview" />
      <main className="app-page" aria-busy="true">
        <p className="eyebrow">Reading the evidence chain</p>
        <h1 className="loading-title">Checking GreenLight…</h1>
        <div className="loading-grid" aria-hidden="true">
          <div />
          <div />
          <div />
        </div>
        <p role="status" className="sr-only">Checking GreenLight…</p>
      </main>
    </>
  );
}

export function LandingPage({
  state,
  status,
  changes,
  signozUrl,
  checkedAt = null,
}: {
  state: LandingState;
  status: DependencyStatus | null;
  changes: ChangeSummary[];
  signozUrl: string;
  checkedAt?: string | null;
}) {
  if (state === "loading") {
    return <LoadingLanding />;
  }

  return (
    <>
      <AppHeader active="overview" signozUrl={signozUrl} />
      <main className="app-page landing-page">
        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <Sparkles size={15} aria-hidden="true" />
              AI change flight recorder
            </p>
            <h1>
              <span className="sr-only">The flight recorder for AI-written code. </span>
              CI said <span className="text-good">green.</span>
              <br />
              Production said <span className="text-danger">otherwise.</span>
            </h1>
            <p className="hero-lede">
              GreenLight connects the coding session, commit, CI run, immutable
              deployment, and the telemetry that followed—then produces a receipt
              a human or agent can actually trust.
            </p>
            <div className="hero-actions">
              {selectFeaturedChange(changes) ? (
                <a
                  className="primary-cta"
                  href={`/changes/${selectFeaturedChange(changes)?.commitSha}`}
                >
                  View the 7.3× regression
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
              ) : (
                <a className="primary-cta" href="/changes">
                  Explore recorded changes
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
              )}
              <a className="secondary-cta" href={signozUrl} rel="noreferrer" target="_blank">
                Open SigNoz
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </div>
            <div className="trust-row" aria-label="Project guarantees">
              <span><ShieldCheck size={16} aria-hidden="true" /> Evidence-first</span>
              <span><Activity size={16} aria-hidden="true" /> OpenTelemetry-native</span>
              <span><RadioTower size={16} aria-hidden="true" /> Live SigNoz links</span>
            </div>
          </div>

          <RecordedIncident changes={changes} />
        </section>

        <section className="story-strip" aria-label="The GreenLight story">
          <article>
            <span className="story-number">01</span>
            <GitBranch size={19} aria-hidden="true" />
            <div>
              <h2>Green pipeline</h2>
              <p>The candidate passed all eight checks and shipped cleanly.</p>
            </div>
          </article>
          <article>
            <span className="story-number">02</span>
            <Gauge size={19} aria-hidden="true" />
            <div>
              <h2>Red production</h2>
              <p>Real traces showed p95 jump from 1.4 ms to 10.4 ms.</p>
            </div>
          </article>
          <article>
            <span className="story-number">03</span>
            <ShieldCheck size={19} aria-hidden="true" />
            <div>
              <h2>Verified recovery</h2>
              <p>The revert shipped as a new version and returned within policy.</p>
            </div>
          </article>
        </section>

        <section className="landing-lower-grid">
          <Readiness
            status={state === "unreachable" ? null : status}
            checkedAt={checkedAt}
          />
          <section className="surface-card principles-card" aria-labelledby="principles-heading">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">Built to be challenged</p>
                <h2 id="principles-heading">A receipt, not a guess</h2>
              </div>
              <CircleDashed size={26} aria-hidden="true" />
            </div>
            <p>
              Every published link must resolve. Missing AI evidence is named.
              Integration failure never masquerades as healthy. Correlation is
              reported as correlation—not causation.
            </p>
            <a className="text-link" href="/changes">
              Browse the full change log
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </section>
        </section>

        <footer className="app-footer">
          <span>GreenLight · Track 03 — Build Your Own</span>
          <span>Agents of SigNoz · OpenTelemetry native</span>
        </footer>
      </main>
    </>
  );
}
