import { useMemo, useRef, useState } from "react";
import { countShortcuts, filterShortcutGroups } from "@/lib/shortcut-search";

type Group = { group: string; shortcuts: { label: string; keys: string[][] }[] };

export const useShortcutHelpSearch = <G extends Group>(groups: readonly G[], open: boolean) => {
  const [query, setQuery] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  const contentRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery("");
  }

  const results = useMemo(() => filterShortcutGroups(groups, query), [groups, query]);

  const focusSearch = () => contentRef.current?.querySelector("input")?.focus();

  const reset = () => {
    setQuery("");
    focusSearch();
  };

  const handleOpenAutoFocus = (event: Event) => {
    event.preventDefault();
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusSearch();
  };

  const handleCloseAutoFocus = (event: Event) => {
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (!target?.isConnected) return;
    event.preventDefault();
    target.focus();
  };

  const handleEscapeKeyDown = (event: KeyboardEvent) => {
    if (!query) return;
    event.preventDefault();
    setQuery("");
  };

  return {
    query,
    setQuery,
    results,
    resultCount: countShortcuts(results),
    totalCount: countShortcuts(groups),
    contentRef,
    reset,
    handleOpenAutoFocus,
    handleCloseAutoFocus,
    handleEscapeKeyDown,
  };
};
