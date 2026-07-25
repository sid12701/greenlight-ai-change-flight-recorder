import { useMemo, useState } from "react";
import type { ChangeSummary } from "@greenlight/shared";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  GitCommitHorizontal,
  Search,
  ShieldAlert,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { formatDateTime } from "../../formatters";
import {
  conclusionPresentation,
  deploymentPresentation,
  regressionPresentation,
  verificationPresentation,
  type StatusPresentation,
  type Tone,
  TONE_CLASS,
} from "../../status";

type ChangeFilter = "all" | "signals" | "awaiting";

const TONE_ICON: Record<Tone, LucideIcon> = {
  good: CheckCircle2,
  bad: XCircle,
  warn: TriangleAlert,
  neutral: CircleDashed,
};

function StatusBadge({
  prefix,
  presentation,
}: {
  prefix: string;
  presentation: StatusPresentation;
}) {
  const Icon = TONE_ICON[presentation.tone];
  return (
    <span
      className={`status-chip ${TONE_CLASS[presentation.tone]}`}
      title={presentation.meaning}
    >
      <Icon size={13} aria-hidden="true" />
      <span className="status-chip-prefix">{prefix}</span>
      {presentation.label}
      <span className="sr-only">. {presentation.meaning}</span>
    </span>
  );
}

export function ChangeRow({ change }: { change: ChangeSummary }) {
  const regression = regressionPresentation(change.regressionStatus);
  return (
    <article className={`change-record change-record--${regression.tone}`}>
      <a className="change-record-link" href={`/changes/${change.commitSha}`}>
        <div className="change-record-status" aria-hidden="true">
          <span />
        </div>
        <div className="change-record-main">
          <div className="change-record-eyebrow">
            <GitCommitHorizontal size={15} aria-hidden="true" />
            <code>{change.shortSha}</code>
            {change.committedAt ? (
              <span>
                <Clock3 size={13} aria-hidden="true" />
                {formatDateTime(change.committedAt)}
              </span>
            ) : null}
          </div>
          <h2>{change.commitSubject ?? change.shortSha}</h2>
          <div className="change-badges">
            <StatusBadge prefix="Verdict" presentation={regression} />
            <StatusBadge
              prefix="AI"
              presentation={verificationPresentation(change.aiVerificationState)}
            />
            <StatusBadge
              prefix="CI"
              presentation={conclusionPresentation(change.primaryWorkflowConclusion)}
            />
            <StatusBadge
              prefix="Deploy"
              presentation={deploymentPresentation(change.deploymentStatus)}
            />
          </div>
        </div>
        <span className="change-record-action">
          View receipt
          <ArrowRight size={17} aria-hidden="true" />
        </span>
      </a>
    </article>
  );
}

function ChangeListLoading() {
  return (
    <div className="change-list-loading" aria-hidden="true">
      <div />
      <div />
      <div />
    </div>
  );
}

export function ChangesPage({
  changes,
  state,
}: {
  changes: ChangeSummary[];
  state: "loading" | "empty" | "ready" | "error";
}) {
  const [filter, setFilter] = useState<ChangeFilter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => ({
    total: changes.length,
    deployed: changes.filter((change) => change.deploymentStatus === "succeeded").length,
    regressions: changes.filter((change) => change.regressionStatus === "regressed").length,
    recovered: changes.filter((change) => change.regressionStatus === "recovered").length,
  }), [changes]);

  const visibleChanges = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return changes.filter((change) => {
      const matchesFilter = filter === "all"
        || (filter === "signals" &&
          (change.regressionStatus === "regressed" || change.regressionStatus === "recovered"))
        || (filter === "awaiting" &&
          (change.regressionStatus === null ||
            change.regressionStatus === "insufficient_data" ||
            change.regressionStatus === "integration_error"));
      const matchesQuery = !normalized ||
        change.commitSha.toLowerCase().includes(normalized) ||
        change.shortSha.toLowerCase().includes(normalized) ||
        (change.commitSubject ?? "").toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [changes, filter, query]);

  return (
    <>
      <AppHeader active="changes" />
      <main className="app-page changes-page">
        <header className="page-intro">
          <p className="eyebrow">
            <GitCommitHorizontal size={15} aria-hidden="true" />
            Immutable evidence log
          </p>
          <div className="page-title-row">
            <div>
              <h1>Every change. Every signal.</h1>
              <p>
                Follow a commit from authoring context to CI, deployment, production
                impact, and recovery. Unknowns stay unknown.
              </p>
            </div>
            <span className="track-pill">Track 03 · Build Your Own</span>
          </div>
        </header>

        <section className="summary-grid" aria-label="Change summary">
          <article>
            <span>Recorded</span>
            <strong>{counts.total}</strong>
            <small>commits observed</small>
          </article>
          <article>
            <span>Deployed</span>
            <strong>{counts.deployed}</strong>
            <small>immutable versions</small>
          </article>
          <article className="summary-card--danger">
            <span>Regressions</span>
            <strong>{counts.regressions}</strong>
            <small>measured from traces</small>
          </article>
          <article className="summary-card--good">
            <span>Recovered</span>
            <strong>{counts.recovered}</strong>
            <small>verified remediations</small>
          </article>
        </section>

        <section className="change-explorer" aria-labelledby="change-explorer-heading">
          <div className="explorer-header">
            <div>
              <p className="section-kicker">Evidence records</p>
              <h2 id="change-explorer-heading">Change history</h2>
            </div>
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search changes</span>
              <input
                type="search"
                placeholder="Search commit or SHA"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          <div className="filter-tabs" role="group" aria-label="Filter changes">
            {([
              ["all", "All changes"],
              ["signals", "Impact signals"],
              ["awaiting", "Awaiting verdict"],
            ] as Array<[ChangeFilter, string]>).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={filter === value ? "is-active" : undefined}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {state === "loading" ? (
            <>
              <p role="status" className="sr-only">Loading changes…</p>
              <ChangeListLoading />
            </>
          ) : null}

          {state === "error" ? (
            <div role="alert" className="empty-panel empty-panel--danger">
              <ShieldAlert size={25} aria-hidden="true" />
              <div>
                <h2>Evidence log unavailable</h2>
                <p>Check the live system status before trusting a stale view.</p>
                <a className="text-link" href="/">Return to overview <ArrowRight size={15} /></a>
              </div>
            </div>
          ) : null}

          {state === "empty" ? (
            <div className="empty-panel">
              <CircleDashed size={25} aria-hidden="true" />
              <div>
                <h2>No changes recorded yet</h2>
                <p>Run a baseline, candidate, and recovery cycle to create the first receipt.</p>
                <code>node scripts/demo-chain.mjs &lt;baseline&gt; &lt;candidate&gt; &lt;recovery&gt;</code>
              </div>
            </div>
          ) : null}

          {state === "ready" && visibleChanges.length ? (
            <div className="change-records">
              {visibleChanges.map((change) => (
                <ChangeRow key={change.commitSha} change={change} />
              ))}
            </div>
          ) : null}

          {state === "ready" && visibleChanges.length === 0 ? (
            <div className="empty-panel">
              <Search size={24} aria-hidden="true" />
              <div>
                <h2>No matching evidence</h2>
                <p>Try a different SHA, commit subject, or verdict filter.</p>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
