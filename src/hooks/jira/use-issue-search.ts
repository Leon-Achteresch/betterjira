import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";
import { PAGE_SIZE, searchIssues } from "@/lib/jira/search";

export const useIssueSearch = (jql: string, fields: readonly string[], pageSize = PAGE_SIZE) => {
  const site = useJiraSite();
  return useInfiniteQuery({
    queryKey: jiraKeys.search(jql, fields, pageSize),
    queryFn: ({ signal, pageParam }) => Effect.runPromise(searchIssues(jql, fields, pageParam, pageSize), { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => (page.isLast ? undefined : (page.nextPageToken ?? undefined)),
    enabled: !!site.data && jql.trim() !== "",
    placeholderData: keepPreviousData,
    retry: false,
  });
};
