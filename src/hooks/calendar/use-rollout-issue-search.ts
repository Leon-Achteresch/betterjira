import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { Effect } from "effect";
import { calendarKeys } from "@/lib/calendar/model";
import { ISSUE_SEARCH_LIMIT, issueSearchJql, issueSummary } from "@/lib/calendar/presentation";
import { searchIssues } from "@/lib/jira/search";

const FIELDS = ["summary"] as const;

export const useRolloutIssueSearch = (siteUrl: string | undefined, query: string, enabled: boolean) => {
  const [debounced] = useDebouncedValue(query.trim(), { wait: 250 });
  return useQuery({
    queryKey: calendarKeys.issues(siteUrl ?? "", debounced),
    queryFn: ({ signal }) =>
      Effect.runPromise(
        searchIssues(issueSearchJql(debounced), FIELDS, undefined, ISSUE_SEARCH_LIMIT).pipe(
          Effect.map((page) => page.issues.map((issue) => ({ key: issue.key, summary: issueSummary(issue.fields) }))),
        ),
        { signal },
      ),
    enabled: enabled && !!siteUrl,
    retry: false,
    staleTime: 30_000,
  });
};
