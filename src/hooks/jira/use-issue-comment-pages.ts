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
import { withJiraQueryScope } from "@/lib/jira/query-scope";
import { jiraErrors } from "@/lib/jira/field-values";

export type CommentPaging = { startAt?: number; maxResults?: number; total?: number };

export function useIssueCommentPages(issueKey: string, comments: readonly JiraComment[], paging?: CommentPaging) {
  const queryClient = useQueryClient();
  const site = useJiraSite();
  const myself = useJiraMyself();
  const cloudId = site.data?.cloudId;
  const accountId = myself.data?.accountId;
  const queryKey = commentPageKeys.issue(cloudId ?? "", accountId ?? "", issueKey);
  const scope = cloudId && accountId ? { cloudId, accountId } : undefined;
  const scopeKey = JSON.stringify(queryKey);
  const [request, setRequest] = useState({ scope: scopeKey, requested: false });
  if (request.scope !== scopeKey) setRequest({ scope: scopeKey, requested: false });
  const requested = request.scope === scopeKey && request.requested;
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const statusRef = useRef<HTMLParagraphElement>(null);
  const first: CommentPage = { ...paging, comments, requestedAt: 0 };
  const start = initialCommentPosition(first);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => Effect.runPromise(withJiraQueryScope(queryClient, scope, fetchCommentPage(issueKey, pageParam)), { signal }),
    initialPageParam: start ?? 0,
    getNextPageParam: nextCommentPosition,
    enabled: !!cloudId && !!accountId && requested,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const pages = query.data?.pages ?? [];
  const thread = summarizeCommentThread(first, pages);
  const loading = query.isFetching;
  const failed = query.isError;

  const loadMore = async (event?: { currentTarget: HTMLElement }) => {
    const fetchStatus = queryClient.getQueryState(queryKey)?.fetchStatus;
    if (loading || !scope || fetchStatus === "fetching" || fetchStatus === "paused") return;
    const hadFocus = event?.currentTarget === document.activeElement;
    const pending = pages.length === 0 || query.isRefetchError
      ? query.refetch({ cancelRefetch: false })
      : query.fetchNextPage({ cancelRefetch: false });
    setRequest({ scope: scopeKey, requested: true });
    const result = await pending;
    const last = result.data?.pages.at(-1);
    if (hadFocus && currentScope.current === scopeKey && last && nextCommentPosition(last) === undefined && !result.isError)
      statusRef.current?.focus();
  };

  return {
    ...thread,
    incomplete: thread.incomplete && !query.isFetching && !query.isRefetchError && query.fetchStatus !== "paused",
    visible: thread.next !== undefined || thread.incomplete || pages.length > 0 || failed,
    loading,
    waiting: query.fetchStatus === "paused",
    ready: !!scope,
    error: failed ? (jiraErrors(query.error).messages.join(" ") || "Kommentare konnten nicht geladen werden") : null,
    statusRef,
    loadMore,
  };
}

export type IssueCommentPages = ReturnType<typeof useIssueCommentPages>;
