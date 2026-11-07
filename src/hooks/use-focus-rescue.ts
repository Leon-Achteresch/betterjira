import { useCallback, useRef } from "react";

export function useFocusRescue<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const rescue = useCallback(() => {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body || !active.isConnected) ref.current?.focus({ preventScroll: true });
    });
  }, []);
  return { ref, rescue };
}
