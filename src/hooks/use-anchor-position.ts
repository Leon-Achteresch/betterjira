import { autoUpdate, computePosition, flip, offset, shift, type VirtualElement } from "@floating-ui/dom";
import { type RefObject, useLayoutEffect } from "react";

export function useAnchorPosition({
  open,
  anchor,
  floatingRef,
}: {
  open: boolean;
  anchor: (() => DOMRect | null) | null;
  floatingRef: RefObject<HTMLElement | null>;
}) {
  useLayoutEffect(() => {
    const floating = floatingRef.current;
    if (!open || !anchor || !floating) return;
    const reference: VirtualElement = { getBoundingClientRect: () => anchor() ?? new DOMRect() };
    const update = () => {
      void computePosition(reference, floating, {
        strategy: "fixed",
        placement: "bottom-start",
        middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        floating.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      });
    };
    return autoUpdate(reference, floating, update, { animationFrame: true });
  }, [open, anchor, floatingRef]);
}
