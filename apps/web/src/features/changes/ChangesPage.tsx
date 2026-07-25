import type { ChangeSummary } from "@greenlight/shared";
import {
  conclusionPresentation,
  deploymentPresentation,
  regressionPresentation,
  verificationPresentation,
  type StatusPresentation,
  TONE_CLASS,
} from "../../status";

/**
 * Every badge carries its meaning, not just a colour and a raw enum value.
 *
 * The previous list rendered all four badges in the same neutral grey, so a
 * regressed change and a healthy one looked identical.
 */
function StatusBadge({
  prefix,
  presentation,
}: {
  prefix: string;
  presentation: StatusPresentation;
}) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${TONE_CLASS[presentation.tone]}`}
      title={presentation.meaning}
    >
      <span className="opacity-70">{prefix}</span> {presentation.label}
      <span className="sr-only">. {presentation.meaning}</span>
    </span>
  );
}

export function ChangeRow({ change }: { change: ChangeSummary }) {
  const regression = regressionPresentation(change.regressionStatus);
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            <a className="underline decoration-slate-600 underline-offset-4" href={`/changes/${change.commitSha}`}>
              {change.commitSubject ?? change.shortSha}
            </a>
          </h2>
          <p className="break-all font-mono text-sm text-slate-400">{change.commitSha}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* The verdict leads: it is the reason to open the receipt. */}
          <StatusBadge prefix="Verdict:" presentation={regression} />
          <StatusBadge
            prefix="AI:"
            presentation={verificationPresentation(change.aiVerificationState)}
          />
          <StatusBadge
            prefix="CI:"
            presentation={conclusionPresentation(change.primaryWorkflowConclusion)}
          />
          <StatusBadge
            prefix="Deploy:"
            presentation={deploymentPresentation(change.deploymentStatus)}
          />
        </div>
      </div>
    </article>
  );
}

export function ChangesPage({
  changes,
  state,
}: {
  changes: ChangeSummary[];
  state: "loading" | "empty" | "ready" | "error";
}) {
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <header className="space-y-1">
        <a className="text-sm text-slate-400 underline underline-offset-4" href="/">
          ← Overview
        </a>
        <h1 className="text-3xl font-bold">Changes</h1>
        <p className="text-slate-400">AI-linked commits with CI, deployment, and regression status.</p>
      </header>
      {state === "loading" ? <p role="status">Loading changes…</p> : null}
      {state === "error" ? (
        <p role="alert" className="text-red-300">
          Unable to load changes. Check readiness on the{" "}
          <a className="underline underline-offset-4" href="/">
            overview
          </a>
          .
        </p>
      ) : null}
      {state === "empty" ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p>No changes recorded yet.</p>
          <p className="mt-2 text-sm text-slate-400">
            Record one by running a full baseline, regression, and recovery cycle:
          </p>
          <code className="mt-2 block break-all rounded bg-slate-950 px-2 py-2 font-mono text-xs text-amber-200">
            node scripts/demo-chain.mjs &lt;baseline-sha&gt; &lt;candidate-sha&gt; &lt;recovery-sha&gt;
          </code>
        </div>
      ) : null}
      {state === "ready"
        ? changes.map((change) => <ChangeRow key={change.commitSha} change={change} />)
        : null}
    </main>
  );
}
