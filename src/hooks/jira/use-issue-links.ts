import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { fetchIssueLinks, issueLinkKeys } from "@/lib/jira/issue-links";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { useIssueLinkActions } from "@/hooks/jira/use-issue-link-actions";
import { withJiraQueryScope } from "@/lib/jira/query-scope";

export function useIssueLinks(issueKey: string) {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const client = useQueryClient();
  const cloudId = site.data?.cloudId;
  const accountId = myself.data?.accountId;
  const scope = cloudId && accountId ? { cloudId, accountId } : undefined;
  const query = useQuery({
    queryKey: issueLinkKeys.issue(cloudId ?? "", accountId ?? "", issueKey),
    queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope, fetchIssueLinks(issueKey)), { signal }),
    enabled: !!cloudId && !!accountId,
  });
  const accountError = !accountId && myself.isError ? myself.error : null;
  const actions = useIssueLinkActions(issueKey, query.data);

  return {
    actions,
    summary: query.data,
    error: query.data ? null : (query.error ?? accountError),
    refreshError: query.data && query.isRefetchError ? query.error : null,
    retrying: query.isFetching || myself.isFetching,
    retry: () => void (accountError ? myself.refetch() : query.refetch()),
  };
}

export type IssueLinksState = ReturnType<typeof useIssueLinks>;
