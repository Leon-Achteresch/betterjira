import { type KeyboardEvent, useState } from "react";
import { create } from "zustand";
import { useOnOpen } from "@/lib/hooks/use-on-open";
import { useRowCursor } from "@/lib/hooks/use-row-cursor";
import { searchOpenTabs } from "@/lib/open-tab-search";

type OpenTabSearchDialogState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export const useOpenTabSearchDialog = create<OpenTabSearchDialogState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export const useOpenTabSearch = <T extends { key: string; title?: string }>({
  tabs,
  onOpenTab,
}: {
  tabs: readonly T[];
  onOpenTab: (key: string) => void;
}) => {
  const { open, setOpen } = useOpenTabSearchDialog();
  const [query, setQuery] = useState("");
  const results = searchOpenTabs(tabs, query);
  const { activeIndex, moveTo, moveActive } = useRowCursor(
    results.map((tab) => ({ id: tab.key })),
    query,
  );

  useOnOpen(open, () => {
    setQuery("");
    moveTo(null);
  });

  const select = (key: string) => {
    setOpen(false);
    onOpenTab(key);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      select(results[activeIndex].key);
    }
  };

  return {
    open,
    onOpenChange: setOpen,
    query,
    onQueryChange: setQuery,
    results,
    total: tabs.length,
    highlighted: results[activeIndex]?.key,
    onHighlight: moveTo,
    onKeyDown,
    onSelect: select,
    fallbackFocus: () => document.querySelector<HTMLElement>('header button[aria-label="Suchen"]'),
  };
};
