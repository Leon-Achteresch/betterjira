import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { useIssueCommentList } from "@/hooks/jira/use-issue-comment-list";
import { commentJumpState, refetchProgress } from "@/lib/jira/comment-thread";

const HIGHLIGHT_MS = 2000;

type RefetchStart = { commentId: string; at: number };

export function useCommentJump(issueKey: string, commentId: string | undefined, onHandled: () => void) {
  const list = useIssueCommentList(issueKey);
  const reduce = useReducedMotion();
  const [highlighted, setHighlighted] = useState<string | undefined>(undefined);
  const [refetchStart, setRefetchStart] = useState<RefetchStart | undefined>(undefined);
  const handled = useRef<string | undefined>(undefined);
  const latest = useRef({ onHandled, refetch: list.refetch });
  useLayoutEffect(() => {
    latest.current = { onHandled, refetch: list.refetch };
  });
  const startedAt = refetchStart?.commentId === commentId ? refetchStart?.at : undefined;
  const state = commentJumpState(list.data, commentId, refetchProgress(startedAt, list.dataUpdatedAt, list.errorUpdatedAt));

  useEffect(() => {
    if (!commentId) {
      handled.current = undefined;
      return;
    }
    if (handled.current === commentId) return;
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
  }, [commentId, state, reduce]);

  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => setHighlighted(undefined), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);

  return { highlighted };
}
