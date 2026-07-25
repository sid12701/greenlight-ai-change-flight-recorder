import { describeFailure } from "../../failures";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";

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
    <>
      <AppHeader active="receipt" />
      <main className="app-page failure-page">
        <a className="text-link" href="/changes">
          <ArrowLeft size={16} aria-hidden="true" /> All changes
        </a>
        <section role="alert" className="failure-panel">
          <span className="failure-icon" aria-hidden="true"><ShieldAlert size={28} /></span>
          <div>
            <p className="section-kicker">Evidence unavailable</p>
            <h1>{failure.title}</h1>
            <p>{failure.detail}</p>
            <strong>{failure.action}</strong>
            {failure.command ? <code>{failure.command}</code> : null}
            {failure.href ? (
              <a className="primary-cta" href={failure.href}>
                {failure.hrefLabel ?? "Continue"}
              </a>
            ) : null}
          </div>
        </section>
      </main>
    </>
  );
}
