import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { fetchIssueLinks, issueLinkKeys } from "@/lib/jira/issue-links";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";

export function useIssueLinks(issueKey: string) {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const cloudId = site.data?.cloudId;
  const accountId = myself.data?.accountId;
  const query = useQuery({
    queryKey: issueLinkKeys.issue(cloudId ?? "", accountId ?? "", issueKey),
    queryFn: ({ signal }) => Effect.runPromise(fetchIssueLinks(issueKey), { signal }),
    enabled: !!cloudId && !!accountId,
  });
  const accountError = !accountId && myself.isError ? myself.error : null;

  return {
    summary: query.data,
    error: query.data ? null : (query.error ?? accountError),
    refreshError: query.data && query.isRefetchError ? query.error : null,
    retrying: query.isFetching || myself.isFetching,
    retry: () => void (accountError ? myself.refetch() : query.refetch()),
  };
}

export type IssueLinksState = ReturnType<typeof useIssueLinks>;
