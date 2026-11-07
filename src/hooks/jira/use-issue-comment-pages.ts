import { useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import {
  commentPageKeys,
  fetchCommentPage,
  initialCommentPosition,
  nextCommentPosition,
  summarizeCommentThread,
  type CommentPage,
  type JiraComment,
} from "@/lib/jira/comment-pages";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";

export type CommentPaging = { startAt?: number; maxResults?: number; total?: number };

export function useIssueCommentPages(issueKey: string, comments: readonly JiraComment[], paging?: CommentPaging) {
  const queryClient = useQueryClient();
  const site = useJiraSite();
  const myself = useJiraMyself();
  const cloudId = site.data?.cloudId;
  const accountId = myself.data?.accountId;
  const queryKey = commentPageKeys.issue(cloudId ?? "", accountId ?? "", issueKey);
  const [requested, setRequested] = useState(() => queryClient.getQueryData(queryKey) !== undefined);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const first: CommentPage = { ...paging, comments, requestedAt: 0 };
  const start = initialCommentPosition(first);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => Effect.runPromise(fetchCommentPage(issueKey, pageParam), { signal }),
    initialPageParam: start ?? 0,
    getNextPageParam: nextCommentPosition,
    enabled: !!cloudId && !!accountId && requested,
    staleTime: Infinity,
  });

  const pages = query.data?.pages ?? [];
  const thread = summarizeCommentThread(first, pages);
  const loading = query.isFetchingNextPage || (query.isFetching && pages.length === 0);
  const failed = query.isFetchNextPageError || (query.isError && pages.length === 0);

  const loadMore = async (event?: { currentTarget: HTMLElement }) => {
    if (loading || !cloudId || !accountId) return;
    const hadFocus = event?.currentTarget === document.activeElement;
    const pending = pages.length === 0 ? query.refetch({ cancelRefetch: false }) : query.fetchNextPage({ cancelRefetch: false });
    setRequested(true);
    const result = await pending;
    if (hadFocus && !result.hasNextPage && !result.isError) statusRef.current?.focus();
  };

  return {
    ...thread,
    visible: thread.next !== undefined || thread.incomplete || pages.length > 0 || failed,
    loading,
    error: failed ? (query.error?.message ?? "Kommentare konnten nicht geladen werden") : null,
    statusRef,
    loadMore,
  };
}

export type IssueCommentPages = ReturnType<typeof useIssueCommentPages>;
