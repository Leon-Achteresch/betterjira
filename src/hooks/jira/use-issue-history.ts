import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import {
  fetchIssueHistory,
  HISTORY_LIMIT,
  issueHistoryKeys,
  mergeHistoryPages,
  olderPageParam,
  type HistoryPageParam,
} from "@/lib/jira/issue-history";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { jiraQueryScopeMatches, jiraRequestScope, withJiraQueryScope } from "@/lib/jira/query-scope";
import { useStatusIntervals } from "@/hooks/use-status-intervals";
import { useLatestRef } from "@/hooks/use-latest-ref";
import type { StatusIdentity } from "@/lib/jira/status-intervals";

export function useIssueHistory(issueKey: string, issue?: { created: string; status: StatusIdentity }) {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const client = useQueryClient();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const cloudId = site.data?.cloudId;
  const accountId = myself.data?.accountId;
  const scope = cloudId && accountId ? { cloudId, accountId } : undefined;
  const context = JSON.stringify([cloudId, accountId, issueKey]);
  const latest = useLatestRef(context);
  const open = openKey === context;
  const isCurrent = () => latest.current === context && jiraQueryScopeMatches(client, scope);
  const query = useInfiniteQuery({
    queryKey: issueHistoryKeys.issue(cloudId ?? "", accountId ?? "", issueKey),
    queryFn: ({ pageParam, signal }) => Effect.runPromise(withJiraQueryScope(client, scope, fetchIssueHistory(issueKey, pageParam, scope ? jiraRequestScope(client, scope) : undefined)), { signal }),
    initialPageParam: null as HistoryPageParam,
    getNextPageParam: (_page, pages) => olderPageParam(pages),
    select: (data) => mergeHistoryPages(data.pages),
    enabled: open && !!cloudId && !!accountId,
    placeholderData: undefined,
  });
  const history = query.data;
  const accountError = open && !accountId && myself.isError ? myself.error : null;
  const moreError = history && query.isFetchNextPageError ? query.error : null;
  const refreshError = history && query.isRefetchError ? query.error : null;
  const statusIntervals = useStatusIntervals({ context, history, current: issue?.status, created: issue?.created, updatedAt: query.dataUpdatedAt, failed: !!moreError || !!refreshError, limit: HISTORY_LIMIT });

  return {
    open,
    onOpenChange: (next: boolean) => { if (latest.current === context) setOpenKey(next ? context : null); },
    history,
    statusIntervals,
    limit: HISTORY_LIMIT,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    onLoadMore: () => { if (isCurrent()) void query.fetchNextPage({ cancelRefetch: false }); },
    error: history ? null : (query.error ?? accountError),
    refreshError,
    moreError,
    retrying: query.isFetching || myself.isFetching,
    onRetry: () => {
      if (latest.current !== context || (scope && !isCurrent())) return;
      if (accountError) void myself.refetch();
      else if (moreError) void query.fetchNextPage({ cancelRefetch: false });
      else void query.refetch({ cancelRefetch: false });
    },
  };
}

export type IssueHistoryState = ReturnType<typeof useIssueHistory>;
