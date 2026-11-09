import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import { Effect } from "effect";
import { jiraKeys } from "./keys";
import { PAGE_SIZE, searchIssues } from "./search";

export const issueSearchQuery = (jql: string, requestedFields: readonly string[], pageSize = PAGE_SIZE) => {
  const fields = [...new Set(requestedFields)].sort();
  return infiniteQueryOptions({
    queryKey: jiraKeys.search(jql, fields, pageSize),
    queryFn: ({ signal, pageParam }) => Effect.runPromise(searchIssues(jql, fields, pageParam, pageSize), { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page, _pages, token, tokens) => {
      const next = page.nextPageToken;
      return page.isLast || !next || next === token || tokens.includes(next) ? undefined : next;
    },
    placeholderData: keepPreviousData,
    retry: false,
  });
};
