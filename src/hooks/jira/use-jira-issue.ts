import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useJiraQueryScope } from "@/hooks/jira/use-jira-query-scope";
import { issueQuery } from "@/lib/jira/queries";

export function useJiraIssue(key: string) {
  const client = useQueryClient();
  const account = useJiraQueryScope();
  const options = issueQuery(key, account.scope, client);
  const query = useQuery(options);
  return {
    ...query,
    scopeKey: JSON.stringify(options.queryKey),
    scopeError: account.error,
    scopeFetching: account.fetching,
    retryScope: account.retry,
  };
}
