import { useEffect, useRef, type MouseEvent } from "react";
import { useRouterState } from "@tanstack/react-router";

const focusLost = () => !document.activeElement || document.activeElement === document.body;

const focusTarget = (target: HTMLElement | null) => {
  if (!target) return;
  const release = () => {
    if (document.activeElement === target) target.addEventListener("blur", release, { once: true });
    else target.removeAttribute("tabindex");
  };
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  target.addEventListener("blur", release, { once: true });
};

export function useMainContentFocus() {
  const ref = useRef<HTMLElement>(null);
  const path = useRouterState({ select: (state) => state.resolvedLocation?.pathname });
  const previous = useRef(path);

  useEffect(() => {
    const changed = previous.current !== undefined && previous.current !== path;
    previous.current = path;
    if (changed && focusLost()) focusTarget(ref.current);
  }, [path]);

  const skipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    focusTarget(ref.current);
  };

  return { ref, skipToContent };
}
