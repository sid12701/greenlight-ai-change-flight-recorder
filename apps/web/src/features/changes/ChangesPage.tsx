import type { ChangeSummary } from "@greenlight/shared";

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-medium text-slate-200">
      {label}
    </span>
  );
}

export function ChangeRow({ change }: { change: ChangeSummary }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            <a className="underline decoration-slate-600 underline-offset-4" href={`/changes/${change.commitSha}`}>
              {change.commitSubject ?? change.shortSha}
            </a>
          </h2>
          <p className="break-all text-sm text-slate-400">{change.commitSha}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`AI: ${change.aiVerificationState}`} />
          <StatusBadge label={`CI: ${change.primaryWorkflowConclusion ?? "none"}`} />
          <StatusBadge label={`Deploy: ${change.deploymentStatus ?? "none"}`} />
          <StatusBadge label={`Regression: ${change.regressionStatus ?? "none"}`} />
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
  if (state === "loading") {
    return <p role="status">Loading changes…</p>;
  }
  if (state === "error") {
    return <p role="alert">Unable to load changes.</p>;
  }
  if (state === "empty") {
    return <p>No changes recorded yet.</p>;
  }
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <header>
        <h1 className="text-3xl font-bold">Changes</h1>
        <p className="text-slate-400">AI-linked commits with CI, deployment, and regression status.</p>
      </header>
      {changes.map((change) => (
        <ChangeRow key={change.commitSha} change={change} />
      ))}
    </main>
  );
}
