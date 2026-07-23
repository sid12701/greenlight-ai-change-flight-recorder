import { useQuery } from "@tanstack/react-query";
import { fetchChanges } from "../../api/client";
import { ChangesPage as ChangesView } from "./ChangesPage";

export function ChangesPageContainer() {
  const query = useQuery({
    queryKey: ["changes"],
    queryFn: fetchChanges,
  });

  const state = query.isLoading
    ? "loading"
    : query.isError
      ? "error"
      : query.data?.changes.length
        ? "ready"
        : "empty";

  return <ChangesView changes={query.data?.changes ?? []} state={state} />;
}

export { ChangesPageContainer as ChangesPage };
