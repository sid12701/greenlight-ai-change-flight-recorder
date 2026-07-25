import {
  Activity,
  ArrowUpRight,
  GitCommitHorizontal,
  Radar,
} from "lucide-react";

export function AppHeader({
  active,
  signozUrl,
}: {
  active: "overview" | "changes" | "receipt";
  signozUrl?: string;
}) {
  return (
    <header className="app-header">
      <a className="brand-lockup" href="/" aria-label="GreenLight overview">
        <span className="brand-mark" aria-hidden="true">
          <Radar size={20} strokeWidth={2.2} />
        </span>
        <span>
          <span className="brand-name">GreenLight</span>
          <span className="brand-tagline">AI change intelligence</span>
        </span>
      </a>

      <nav className="app-nav" aria-label="Primary navigation">
        <a
          className="app-nav-link"
          href="/"
          aria-current={active === "overview" ? "page" : undefined}
        >
          <Activity size={16} aria-hidden="true" />
          Overview
        </a>
        <a
          className="app-nav-link"
          href="/changes"
          aria-current={active === "changes" || active === "receipt" ? "page" : undefined}
        >
          <GitCommitHorizontal size={16} aria-hidden="true" />
          Change log
        </a>
      </nav>

      {signozUrl ? (
        <a
          className="signoz-link"
          href={signozUrl}
          rel="noreferrer"
          target="_blank"
        >
          <span className="live-dot" aria-hidden="true" />
          SigNoz live
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      ) : (
        <span className="powered-pill">
          <span className="live-dot" aria-hidden="true" />
          Powered by SigNoz
        </span>
      )}
    </header>
  );
}
