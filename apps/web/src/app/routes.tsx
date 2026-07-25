import { ChangesPage } from "../features/changes";
import { LandingPage } from "../features/landing";
import { ReceiptPage } from "../features/receipts";

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
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-slate-400">This GreenLight route does not exist.</p>
      <a className="underline underline-offset-4" href="/">
        Back to the overview
      </a>
    </main>
  );
}
