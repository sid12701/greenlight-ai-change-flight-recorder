import { useQuery } from "@tanstack/react-query";
import { ApiError, fetchReceipt } from "../../api/client";
import { ReceiptPageView } from "./ReceiptPage";
import { FailureNotice } from "./FailureNotice";
import { AppHeader } from "../../components/AppHeader";

export function ReceiptPage({ commitSha }: { commitSha: string }) {
  const query = useQuery({
    queryKey: ["receipt", commitSha],
    queryFn: () => fetchReceipt(commitSha),
    enabled: Boolean(commitSha),
    // Authorisation and not-found do not become true by asking again, and
    // retrying them only delays the message that explains what to do.
    retry: (failureCount, error) =>
      failureCount < 2 &&
      error instanceof ApiError &&
      error.code === "unavailable",
  });

  if (query.isLoading) {
    return (
      <>
        <AppHeader active="receipt" />
        <main className="app-page receipt-loading" aria-busy="true">
          <p role="status">Loading receipt…</p>
          <div aria-hidden="true"><span /><span /><span /></div>
        </main>
      </>
    );
  }
  if (query.isError || !query.data) {
    return <FailureNotice error={query.error} />;
  }
  return <ReceiptPageView receipt={query.data} />;
}
