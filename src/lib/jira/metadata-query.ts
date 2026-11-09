import { queryOptions } from "@tanstack/react-query";
import { Effect } from "effect";
import { jiraKeys } from "./keys";
import { fetchFields } from "./search";

export const fieldCatalogQuery = () => queryOptions({
  queryKey: jiraKeys.fieldCatalog,
  queryFn: ({ signal }) => Effect.runPromise(fetchFields, { signal }),
  staleTime: 60 * 60_000,
  gcTime: 60 * 60_000,
});
