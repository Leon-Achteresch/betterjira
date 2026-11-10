import { useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import {
  commentPageKeys,
  fetchCommentPage,
  summarizeCommentPages,
  type CommentPage,
  type JiraComment,
} from "@/lib/jira/comment-pages";
import { toIssueComment, type RawComment } from "@/lib/jira/comment-thread";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { withJiraQueryScope } from "@/lib/jira/query-scope";
import { jiraErrors } from "@/lib/jira/field-values";

export type CommentPaging = { startAt?: number; maxResults?: number; total?: number };

const NO_COMMENTS: readonly JiraComment[] = [];

export function useIssueCommentPages(issueKey: string, embedded: readonly (typeof RawComment.Type)[], paging?: CommentPaging) {
  const queryClient = useQueryClient();
  const site = useJiraSite();
  const myself = useJiraMyself();
  const cloudId = site.data?.cloudId;
  const accountId = myself.data?.accountId;
  const queryKey = commentPageKeys.issue(cloudId ?? "", accountId ?? "", issueKey);
  const scope = cloudId && accountId ? { cloudId, accountId } : undefined;
  const scopeKey = JSON.stringify(queryKey);
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const statusRef = useRef<HTMLParagraphElement>(null);
  const first: CommentPage = { ...paging, comments: embedded.map(toIssueComment), requestedAt: 0 };
  const currentFirst = useRef(first);
  currentFirst.current = first;
  const posted = useQuery({
    queryKey: commentPageKeys.posted(cloudId ?? "", accountId ?? "", issueKey),
    queryFn: () => NO_COMMENTS,
    initialData: NO_COMMENTS,
    enabled: false,
    staleTime: Infinity,
  }).data;

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => Effect.runPromise(withJiraQueryScope(queryClient, scope, fetchCommentPage(issueKey, pageParam)), { signal }),
    initialPageParam: 0,
    getNextPageParam: (_last, pages) => summarizeCommentPages(first, pages).next,
    enabled: !!cloudId && !!accountId,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const pages = query.data?.pages ?? [];
  const loadedComments = summarizeCommentPages(first, pages, posted);
  const loading = query.isFetching;
  const failed = query.isError;

  const loadMore = async (event?: { currentTarget: HTMLElement }) => {
    const fetchStatus = queryClient.getQueryState(queryKey)?.fetchStatus;
    if (loading || !scope || fetchStatus === "fetching" || fetchStatus === "paused") return;
    const hadFocus = event?.currentTarget === document.activeElement;
    const pending = pages.length === 0 || query.isRefetchError
      ? query.refetch({ cancelRefetch: false })
      : query.fetchNextPage({ cancelRefetch: false });
    const result = await pending;
    if (hadFocus && currentScope.current === scopeKey && result.data && !result.isError
      && summarizeCommentPages(currentFirst.current, result.data.pages).next === undefined)
      statusRef.current?.focus();
  };

  return {
    ...loadedComments,
    reportedIncomplete: loadedComments.incomplete,
    incomplete: loadedComments.incomplete && !query.isFetching && !query.isRefetchError && query.fetchStatus !== "paused",
    visible: failed || (pages.length > 0 && (loadedComments.next !== undefined || loadedComments.incomplete || pages.length > 1)),
    firstPageLoaded: pages.length > 0,
    loading,
    waiting: query.fetchStatus === "paused",
    ready: !!scope,
    error: failed ? (jiraErrors(query.error).messages.join(" ") || "Kommentare konnten nicht geladen werden") : null,
    statusRef,
    loadMore,
    refetch: () => query.refetch({ cancelRefetch: false }),
    dataUpdatedAt: query.dataUpdatedAt,
    errorUpdatedAt: query.errorUpdatedAt,
  };
}

export type IssueCommentPages = ReturnType<typeof useIssueCommentPages>;
