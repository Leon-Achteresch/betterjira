import type { KeyboardEvent } from "react";
import { useTheme } from "@/hooks/use-theme";

export function useIssueGridKeys() {
  const { theme } = useTheme();
  if (theme !== "studio") return undefined;

  return (event: KeyboardEvent<HTMLTableSectionElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const { key, target, currentTarget } = event;
    if (key !== "ArrowUp" && key !== "ArrowDown") return;
    if (!(target instanceof HTMLAnchorElement) || !target.matches("[data-row-link]")) return;

    const links = Array.from(currentTarget.querySelectorAll<HTMLAnchorElement>("a[data-row-link]"));
    const next = links[links.indexOf(target) + (key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    next.focus();
  };
}
