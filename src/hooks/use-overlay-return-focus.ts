import { useRef } from "react";

export function useOverlayReturnFocus({
  onOpenAutoFocus,
  onCloseAutoFocus,
}: {
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const targets = useRef<HTMLElement[]>([]);
  return {
    onOpenAutoFocus: (event: Event) => {
      const active = document.activeElement;
      const menu = active?.closest('[role="menu"]');
      const triggerId = menu?.getAttribute("aria-labelledby");
      const trigger = triggerId ? document.getElementById(triggerId) : null;
      targets.current = [active, trigger].filter((target): target is HTMLElement => target instanceof HTMLElement);
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      const target = targets.current.find((element) => element.isConnected);
      if (target) {
        event.preventDefault();
        target.focus({ preventScroll: true });
      }
    },
  };
}
