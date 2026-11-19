import { useId, useRef, useState, type MouseEvent } from "react";
import { useTheme } from "@/hooks/use-theme";

export function useIssuePreviewPane(accountScope: string | null) {
  const { theme } = useTheme();
  const id = useId();
  const [selection, setSelection] = useState<{ key: string; focus: boolean; accountScope: string }>();
  const trigger = useRef<HTMLAnchorElement>(null);
  const studio = theme === "studio";

  return {
    id,
    selection: studio && selection?.accountScope === accountScope ? selection : undefined,
    open: studio && accountScope !== null ? (issueKey: string, event: MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!window.matchMedia("(min-width: 64rem)").matches) return;
      event.preventDefault();
      trigger.current = event.currentTarget;
      setSelection({ key: issueKey, focus: event.detail === 0, accountScope });
    } : undefined,
    close: () => {
      setSelection(undefined);
      trigger.current?.focus({ preventScroll: true });
    },
  };
}
