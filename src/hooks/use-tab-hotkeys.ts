import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { IS_MAC } from "@/lib/platform";
import { cycleTab, tabHotkey } from "@/lib/tab-hotkeys";

type Options = {
  keys: string[];
  activeKey: string | undefined;
  openTab: (key: string) => void;
  closeTab: (key: string) => void;
};

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export const useTabHotkeys = (options: Options) => {
  const router = useRouter();
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const hotkey = tabHotkey(event, IS_MAC);
      if (!hotkey || event.defaultPrevented) return;
      const { keys, activeKey, openTab, closeTab } = latest.current;
      if (hotkey.type === "history") {
        if (event.altKey && isEditable(event.target)) return;
        event.preventDefault();
        router.history.go(hotkey.step);
        return;
      }
      if (hotkey.type === "close") {
        if (!activeKey) return;
        event.preventDefault();
        closeTab(activeKey);
        return;
      }
      event.preventDefault();
      const target = hotkey.type === "select" ? keys[hotkey.index] : cycleTab(keys, activeKey, hotkey.step);
      if (target) openTab(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
};
