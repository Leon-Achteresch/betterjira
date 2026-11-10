import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { toast } from "sonner";
import type { IssueCommentPages } from "@/hooks/jira/use-issue-comment-pages";
import { commentJumpState, refetchProgress } from "@/lib/jira/comment-thread";

const HIGHLIGHT_MS = 2000;
const USER_SCROLL = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

// Content above the target can still change height after the first scroll (rendered HTML arrives, images load).
// Until the highlight ends or the user takes over, re-center the target whenever the scroll content resizes.
const followTarget = (target: HTMLElement, center: () => void) => {
  const content = target.closest<HTMLElement>("[data-scroll-restoration-id]")?.firstElementChild ?? document.body;
  let initial = true;
  const observer = new ResizeObserver(() => {
    if (initial) initial = false;
    else center();
  });
  const stop = () => {
    observer.disconnect();
    clearTimeout(timer);
    for (const type of USER_SCROLL) window.removeEventListener(type, stop, true);
  };
  const timer = setTimeout(stop, HIGHLIGHT_MS);
  for (const type of USER_SCROLL) window.addEventListener(type, stop, { capture: true, passive: true });
  observer.observe(content);
  return stop;
};

type RefetchStart = { commentId: string; at: number };

type JumpPages = Pick<
  IssueCommentPages,
  "comments" | "next" | "firstPageLoaded" | "loading" | "error" | "loadMore" | "refetch" | "dataUpdatedAt" | "errorUpdatedAt"
>;

export function useCommentJump(pages: JumpPages, commentId: string | undefined, onHandled: () => void, closeSearch: () => void) {
  const reduce = useReducedMotion();
  const [highlighted, setHighlighted] = useState<string | undefined>(undefined);
  const [refetchStart, setRefetchStart] = useState<RefetchStart | undefined>(undefined);
  const handled = useRef<string | undefined>(undefined);
  const stopFollowing = useRef<(() => void) | undefined>(undefined);
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
    pages.error !== null,
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
      const target = document.querySelector<HTMLElement>(`[data-comment-id="${CSS.escape(commentId)}"]`);
      if (!target) return;
      const center = () => target.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      center();
      stopFollowing.current?.();
      stopFollowing.current = followTarget(target, center);
    });
  }, [commentId, state, reduce, loading, next]);

  useEffect(() => () => stopFollowing.current?.(), []);

  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => setHighlighted(undefined), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);

  return { highlighted };
}
