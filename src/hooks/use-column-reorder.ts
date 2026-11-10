import { useLayoutEffect, useRef } from "react";
import { canMoveValue, moveValue } from "@/lib/jira/issue-view";

export function useColumnReorder(ids: readonly string[], onReorder: (ids: string[]) => void) {
  const focusAfterMove = useRef<HTMLElement | null>(null);
  const order = ids.join("\u0000");

  useLayoutEffect(() => {
    const target = focusAfterMove.current;
    focusAfterMove.current = null;
    if (target?.isConnected && document.activeElement !== target) target.focus();
  }, [order]);

  return {
    canMove: (id: string, offset: number) => canMoveValue(ids, id, offset),
    move: (id: string, offset: number, focusTarget: HTMLElement) => {
      if (!canMoveValue(ids, id, offset)) return;
      focusAfterMove.current = focusTarget;
      onReorder(moveValue(ids, id, offset));
    },
  };
}
