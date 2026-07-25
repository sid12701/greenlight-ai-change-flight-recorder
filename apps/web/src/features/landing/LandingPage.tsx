import type { ChangeSummary, DependencyState, DependencyStatus } from "@greenlight/shared";
import { selectFeaturedChange } from "./featured";
import { formatDateTime, formatRelativeTime } from "../../formatters";

export type LandingState = "loading" | "ready" | "unreachable";

const DEPENDENCY_LABELS: Record<keyof DependencyStatus["checks"], string> = {
  database: "Database",
  github: "GitHub",
  signoz: "SigNoz",
};

/**
 * What to do about a degraded dependency, in the reader's own terminal.
 *
 * A status page that reports a failure without a next step forces the reader
 * to go and find the runbook, which is exactly the ten seconds a judge does
 * not have.
 */
const DEPENDENCY_REMEDIES: Record<keyof DependencyStatus["checks"], string> = {
  database: "npm run demo:up",
  github: "Check GITHUB_REPOSITORY and GITHUB_TOKEN in .env.demo",
  signoz: "npm run demo:up  # restarts the pinned SigNoz stack",
};

function stateTone(state: DependencyState): string {
  return state === "ok" ? "text-emerald-300" : "text-red-300";
}

function DependencyRow({
  name,
  state,
}: {
  name: keyof DependencyStatus["checks"];
  state: DependencyState;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 py-2 last:border-b-0">
      <span className="font-medium">{DEPENDENCY_LABELS[name]}</span>
      <span className={`text-sm ${stateTone(state)}`}>
        {/* The word carries the meaning; colour alone would exclude readers
            who cannot distinguish it. */}
        {state === "ok" ? "healthy" : "degraded"}
      </span>
      {state === "degraded" ? (
        <code className="w-full break-all rounded bg-slate-950 px-2 py-1 font-mono text-xs text-amber-200">
          {DEPENDENCY_REMEDIES[name]}
        </code>
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
  return (
    <section
      aria-labelledby="readiness-heading"
      className="rounded-xl border border-slate-800 bg-slate-900 p-4"
    >
      <h2 id="readiness-heading" className="text-xl font-semibold">
        System readiness
      </h2>
      {status === null ? (
        <p role="alert" className="mt-3 text-sm text-red-300">
          The GreenLight API could not be reached. Start the stack with{" "}
          <code className="rounded bg-slate-950 px-1 font-mono">npm run demo:up</code>.
        </p>
      ) : (
        <div className="mt-3">
          {(Object.keys(DEPENDENCY_LABELS) as Array<keyof DependencyStatus["checks"]>).map(
            (name) => (
              <DependencyRow key={name} name={name} state={status.checks[name]} />
            ),
          )}
        </div>
      )}
      {/* A readiness panel with no time on it reads as current forever, which
          is exactly how someone ends up trusting a stale one. */}
      {checkedAt ? (
        <p className="mt-3 text-xs text-slate-400">
          Checked{" "}
          <time dateTime={checkedAt}>{formatRelativeTime(checkedAt)}</time>
          {" "}({formatDateTime(checkedAt)}).
        </p>
      ) : null}
    </section>
  );
}

function DemoReceipt({ changes }: { changes: ChangeSummary[] }) {
  const featured = selectFeaturedChange(changes);

  return (
    <section
      aria-labelledby="receipt-heading"
      className="rounded-xl border border-slate-800 bg-slate-900 p-4"
    >
      <h2 id="receipt-heading" className="text-xl font-semibold">
        Verified evidence chain
      </h2>
      {featured ? (
        <>
          <p className="mt-2 text-sm text-slate-400">
            {featured.regressionStatus === "recovered"
              ? "A regression was detected from production telemetry and recovered."
              : `Latest complete chain — regression verdict: ${featured.regressionStatus}.`}
          </p>
          <a
            className="mt-3 inline-block rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-400"
            href={`/changes/${featured.commitSha}`}
          >
            Open the verified receipt
          </a>
          <p className="mt-2 break-all font-mono text-xs text-slate-500">
            {featured.commitSubject ?? featured.shortSha} · {featured.shortSha}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-amber-300">
            {changes.length === 0
              ? "No changes have been recorded yet."
              : `${changes.length} change(s) recorded, but none has a complete chain yet.`}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            A chain is complete when the AI session, CI run, deployment, and
            regression verdict all resolve. Produce one with:
          </p>
          <code className="mt-2 block break-all rounded bg-slate-950 px-2 py-2 font-mono text-xs text-amber-200">
            node scripts/demo-chain.mjs &lt;baseline-sha&gt; &lt;candidate-sha&gt; &lt;recovery-sha&gt;
          </code>
        </>
      )}
    </section>
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
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p role="status">Checking GreenLight…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-wide text-emerald-400">GreenLight</p>
        <h1 className="text-4xl font-bold">The flight recorder for AI-written code</h1>
        <p className="text-lg text-slate-300">
          Every change is traced from the AI session that wrote it, through CI and
          the immutable image that shipped it, to what it did to production —
          and back out again if it broke.
        </p>
      </header>

      <Readiness status={state === "unreachable" ? null : status} checkedAt={checkedAt} />
      <DemoReceipt changes={changes} />

      <nav aria-label="Explore" className="flex flex-wrap gap-3">
        <a
          className="rounded-lg border border-slate-700 px-4 py-2 hover:border-slate-500"
          href="/changes"
        >
          Browse all changes
        </a>
        <a
          className="rounded-lg border border-slate-700 px-4 py-2 hover:border-slate-500"
          href={signozUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open SigNoz
        </a>
      </nav>
    </main>
  );
}
