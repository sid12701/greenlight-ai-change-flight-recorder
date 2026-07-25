import { ChangesPage } from "../features/changes";
import { LandingPage } from "../features/landing";
import { ReceiptPage } from "../features/receipts";
import { AppHeader } from "../components/AppHeader";
import { ArrowLeft, FileQuestion } from "lucide-react";

export type AppRoute =
  | { page: "landing" }
  | { page: "changes" }
  | { page: "receipt"; commitSha: string }
  | { page: "not-found" };

export function matchAppRoute(pathname: string): AppRoute {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  // The root is the landing page: a first-time reader arriving at an empty
  // change list learns nothing about what GreenLight is or what to do next.
  if (normalized === "/") {
    return { page: "landing" };
  }
  if (normalized === "/changes") {
    return { page: "changes" };
  }
  const receipt = normalized.match(/^\/changes\/([0-9a-f]{40})$/i);
  return receipt
    ? { page: "receipt", commitSha: receipt[1].toLowerCase() }
    : { page: "not-found" };
}

export function AppRoutes({
  pathname = window.location.pathname,
}: {
  pathname?: string;
}) {
  const route = matchAppRoute(pathname);
  if (route.page === "landing") {
    return <LandingPage />;
  }
  if (route.page === "changes") {
    return <ChangesPage />;
  }
  if (route.page === "receipt") {
    return <ReceiptPage commitSha={route.commitSha} />;
  }
  return (
    <>
      <AppHeader active="overview" />
      <main className="app-page failure-page">
        <section className="failure-panel">
          <span className="failure-icon" aria-hidden="true"><FileQuestion size={28} /></span>
          <div>
            <p className="section-kicker">404 · unknown route</p>
            <h1>Page not found</h1>
            <p>This GreenLight route does not exist.</p>
            <a className="primary-cta" href="/">
              <ArrowLeft size={16} aria-hidden="true" /> Back to overview
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
