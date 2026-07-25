import { describeFailure } from "../../failures";

/**
 * Renders a failure as a next step rather than as a dead end.
 *
 * The distinction the API drew between failure kinds is only worth drawing if
 * it survives to the screen, so each kind states what happened and the one
 * thing to do about it.
 */
export function FailureNotice({ error }: { error: unknown }) {
  const failure = describeFailure(error);
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <a className="text-sm text-slate-400 underline underline-offset-4" href="/changes">
        ← All changes
      </a>
      <section
        role="alert"
        className="rounded-xl border border-amber-900/50 bg-amber-950/30 p-5"
      >
        <h1 className="text-2xl font-bold text-amber-100">{failure.title}</h1>
        <p className="mt-2 text-sm text-amber-100/90">{failure.detail}</p>
        <p className="mt-4 text-sm text-amber-100">{failure.action}</p>
        {failure.command ? (
          <code className="mt-3 block break-all rounded bg-slate-950 px-2 py-2 font-mono text-xs text-amber-200">
            {failure.command}
          </code>
        ) : null}
        {failure.href ? (
          <p className="mt-3 text-sm">
            <a className="underline underline-offset-4" href={failure.href}>
              {failure.hrefLabel ?? "Continue"}
            </a>
          </p>
        ) : null}
      </section>
    </main>
  );
}
