import { useQuery } from "@tanstack/react-query";
import { fetchReceipt } from "../../api/client";
import { ReceiptPageView } from "./ReceiptPage";

export function ReceiptPage({ commitSha }: { commitSha: string }) {
  const query = useQuery({
    queryKey: ["receipt", commitSha],
    queryFn: () => fetchReceipt(commitSha),
    enabled: Boolean(commitSha),
  });

  if (query.isLoading) {
    return <p role="status">Loading receipt…</p>;
  }
  if (query.isError || !query.data) {
    return <p role="alert">Receipt unavailable.</p>;
  }
  return <ReceiptPageView receipt={query.data} />;
}
