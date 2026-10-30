import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { Effect } from "effect";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";
import { validateJql } from "@/lib/jira/search";

export const useJqlValidation = (jql: string) => {
  const site = useJiraSite();
  const [debounced] = useDebouncedValue(jql.trim(), { wait: 400 });
  return useQuery({
    queryKey: jiraKeys.jqlValidation(debounced),
    queryFn: ({ signal }) =>
      Effect.runPromise(validateJql(debounced), { signal }).then(({ queries }) => queries[0]?.errors ?? []),
    enabled: !!site.data && debounced !== "",
    placeholderData: (previous) => previous,
    staleTime: Infinity,
  });
};
