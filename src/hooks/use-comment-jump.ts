import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { toast } from "sonner";
import type { IssueCommentPages } from "@/hooks/jira/use-issue-comment-pages";
import { commentJumpState, refetchProgress } from "@/lib/jira/comment-thread";

const HIGHLIGHT_MS = 2000;

type RefetchStart = { commentId: string; at: number };

type JumpPages = Pick<
  IssueCommentPages,
  "comments" | "next" | "firstPageLoaded" | "loading" | "loadMore" | "refetch" | "dataUpdatedAt" | "errorUpdatedAt"
>;

export function useCommentJump(pages: JumpPages, commentId: string | undefined, onHandled: () => void, closeSearch: () => void) {
  const reduce = useReducedMotion();
  const [highlighted, setHighlighted] = useState<string | undefined>(undefined);
  const [refetchStart, setRefetchStart] = useState<RefetchStart | undefined>(undefined);
  const handled = useRef<string | undefined>(undefined);
  const searchClosed = useRef<string | undefined>(undefined);
  const latest = useRef({ onHandled, closeSearch, refetch: pages.refetch, loadMore: pages.loadMore });
  useLayoutEffect(() => {
    latest.current = { onHandled, closeSearch, refetch: pages.refetch, loadMore: pages.loadMore };
  });
  const startedAt = refetchStart?.commentId === commentId ? refetchStart?.at : undefined;
  const state = commentJumpState(
    pages.firstPageLoaded ? pages.comments : undefined,
    commentId,
    refetchProgress(startedAt, pages.dataUpdatedAt, pages.errorUpdatedAt),
    pages.next !== undefined,
  );
  const loading = pages.loading;
  const next = pages.next;

  useEffect(() => {
    if (!commentId) {
      handled.current = undefined;
      searchClosed.current = undefined;
      return;
    }
    if (handled.current === commentId) return;
    if (searchClosed.current !== commentId) {
      searchClosed.current = commentId;
      latest.current.closeSearch();
    }
    if (state === "more") {
      if (!loading) void latest.current.loadMore();
      return;
    }
    if (state === "refetch") {
      setRefetchStart({ commentId, at: Date.now() });
      void latest.current.refetch();
      return;
    }
    if (state !== "found" && state !== "missing") return;
    handled.current = commentId;
    latest.current.onHandled();
    if (state === "missing") {
      toast("Kommentar nicht mehr vorhanden");
      return;
    }
    setHighlighted(commentId);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-comment-id="${CSS.escape(commentId)}"]`)
        ?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    });
  }, [commentId, state, reduce, loading, next]);

  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => setHighlighted(undefined), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);

  return { highlighted };
}
