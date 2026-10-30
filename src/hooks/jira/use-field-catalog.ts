import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";
import { fetchFields } from "@/lib/jira/search";

export const useFieldCatalog = () => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.fieldCatalog,
    queryFn: ({ signal }) => Effect.runPromise(fetchFields, { signal }),
    enabled: !!site.data,
    staleTime: 60 * 60_000,
  });
};
