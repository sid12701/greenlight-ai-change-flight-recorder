import { useQuery } from "@tanstack/react-query";
import { fetchChanges, fetchDependencyStatus } from "../../api/client";
import { LandingPage as LandingView, type LandingState } from "./LandingPage";

const SIGNOZ_URL = import.meta.env.VITE_SIGNOZ_URL ?? "http://127.0.0.1:8080";

export function LandingPageContainer() {
  const status = useQuery({
    queryKey: ["dependency-status"],
    queryFn: fetchDependencyStatus,
    // Readiness is the one thing on this page that goes stale while it is
    // being read, so it refreshes on its own.
    refetchInterval: 15_000,
    retry: false,
  });
  const changes = useQuery({
    queryKey: ["changes"],
    queryFn: fetchChanges,
    retry: false,
  });

  const state: LandingState = status.isLoading || changes.isLoading
    ? "loading"
    : status.isError
      ? "unreachable"
      : "ready";

  return (
    <LandingView
      changes={changes.data?.changes ?? []}
      signozUrl={SIGNOZ_URL}
      state={state}
      status={status.data ?? null}
      // When the answer was actually received, not when this rendered.
      checkedAt={
        status.dataUpdatedAt ? new Date(status.dataUpdatedAt).toISOString() : null
      }
    />
  );
}

export { LandingPageContainer as LandingPage };
