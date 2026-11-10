import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
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

export function useIssueHistory(issueKey: string) {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = openKey === issueKey;
  const cloudId = site.data?.cloudId;
  const accountId = myself.data?.accountId;
  const query = useInfiniteQuery({
    queryKey: issueHistoryKeys.issue(cloudId ?? "", accountId ?? "", issueKey),
    queryFn: ({ pageParam, signal }) => Effect.runPromise(fetchIssueHistory(issueKey, pageParam), { signal }),
    initialPageParam: null as HistoryPageParam,
    getNextPageParam: (_page, pages) => olderPageParam(pages),
    select: (data) => mergeHistoryPages(data.pages),
    enabled: open && !!cloudId && !!accountId,
  });
  const history = query.data;
  const accountError = open && !accountId && myself.isError ? myself.error : null;
  const moreError = history && query.isFetchNextPageError ? query.error : null;
  const refreshError = history && query.isRefetchError ? query.error : null;

  return {
    open,
    onOpenChange: (next: boolean) => setOpenKey(next ? issueKey : null),
    history,
    limit: HISTORY_LIMIT,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    onLoadMore: () => void query.fetchNextPage({ cancelRefetch: false }),
    error: history ? null : (query.error ?? accountError),
    refreshError,
    moreError,
    retrying: query.isFetching || myself.isFetching,
    onRetry: () => {
      if (accountError) void myself.refetch();
      else if (moreError) void query.fetchNextPage({ cancelRefetch: false });
      else void query.refetch({ cancelRefetch: false });
    },
  };
}

export type IssueHistoryState = ReturnType<typeof useIssueHistory>;
