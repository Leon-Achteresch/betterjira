import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { mentionSearch } from "@/lib/jira/comments";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";

export const useMentionSearch = (issueKey: string, query: string) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.mentionSearch(issueKey, query),
    queryFn: ({ signal }) => Effect.runPromise(mentionSearch(issueKey, query), { signal }),
    enabled: !!site.data && query.length > 0,
    staleTime: 60_000,
    retry: false,
  });
};
