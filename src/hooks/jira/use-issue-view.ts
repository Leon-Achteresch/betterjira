import { useState } from "react";
import { issueLoadState, loadedAtLabel } from "@/lib/jira/issue-load";
import { useJiraIssue } from "@/hooks/jira/use-jira-issue";

export function useIssueView(issueKey: string) {
  const query = useJiraIssue(issueKey);
  const currentError = query.scopeError ?? query.error;
  const refreshing = query.isFetching || query.scopeFetching;
  const [previous, setPrevious] = useState<{ scope: string; error: Error | null; account: boolean }>({ scope: query.scopeKey, error: null, account: false });
  if (previous.scope !== query.scopeKey) setPrevious({ scope: query.scopeKey, error: currentError, account: !!query.scopeError });
  else if (currentError && currentError !== previous.error) setPrevious({ scope: query.scopeKey, error: currentError, account: !!query.scopeError });
  const lastError = previous.scope === query.scopeKey ? previous.error : null;
  const error = currentError ?? (!query.data && refreshing ? lastError : null);
  const accountError = !!query.scopeError || (!currentError && refreshing && previous.scope === query.scopeKey && previous.account);

  return {
    issue: query.data,
    load: issueLoadState({ data: query.data, error, loadedAt: query.dataUpdatedAt, accountError }),
    loadedLabel: loadedAtLabel(query.dataUpdatedAt, Date.now()),
    refreshing,
    refresh: query.scopeError ? query.retryScope : () => void query.refetch({ cancelRefetch: false }),
  };
}
