import { useState } from "react";
import { issueLoadState, loadedAtLabel } from "@/lib/jira/issue-load";
import { useJiraIssue } from "@/lib/jira/queries";

export function useIssueView(issueKey: string) {
  const query = useJiraIssue(issueKey);
  const [lastError, setLastError] = useState<Error | null>(null);
  if (query.error && query.error !== lastError) setLastError(query.error);
  const error = query.error ?? (!query.data && query.isFetching ? lastError : null);

  return {
    issue: query.data,
    load: issueLoadState({ data: query.data, error, loadedAt: query.dataUpdatedAt }),
    loadedLabel: loadedAtLabel(query.dataUpdatedAt, Date.now()),
    refreshing: query.isFetching,
    refresh: () => void query.refetch({ cancelRefetch: false }),
  };
}
