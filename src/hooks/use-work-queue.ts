import { useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useWorkspace } from "@/hooks/use-workspace";
import { useFieldDraftStore } from "@/hooks/use-field-drafts";
import { scopedFieldDraftKeys, togglePinnedIssue, workQueueItems, type WorkQueueFilter } from "@/lib/workspace";

export function useWorkQueue() {
  const { id, workspace, update, ready } = useWorkspace();
  const fieldDrafts = useFieldDraftStore((state) => state.drafts);
  const fieldDraftKeys = scopedFieldDraftKeys(Object.keys(fieldDrafts), id);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<WorkQueueFilter>("recent");
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const all = workQueueItems(workspace, "recent", "", fieldDraftKeys);
  const items = workQueueItems(workspace, filter, query, fieldDraftKeys);
  const emptyTitle = query
    ? "Kein passendes Ticket"
    : filter === "pinned"
      ? "Noch nichts angeheftet"
      : filter === "drafts"
        ? "Nichts angefangen"
        : "Hier geht es später weiter";
  const emptyDescription = query
    ? "Suche nach einem anderen Schlüssel oder einem Wort aus deiner Notiz."
    : filter === "pinned"
      ? "Hefte ein Ticket mit dem Stecknadel-Symbol an, um es hier zu behalten."
      : filter === "drafts"
        ? "Kommentar- und Feldentwürfe sowie private Notizen findest du hier wieder."
        : "Öffne ein Ticket. Deine letzte Lesestelle wird automatisch gemerkt.";

  return {
    ready,
    open,
    setOpen,
    query,
    setQuery,
    filter,
    setFilter,
    items,
    emptyTitle,
    emptyDescription,
    count: all.length,
    draftCount: all.filter((item) => item.hasDraft || item.hasFieldDraft || item.note.trim()).length,
    currentKey: pathname.startsWith("/issue/") ? decodeURIComponent(pathname.slice(7)) : undefined,
    openIssue: (key: string) => {
      setOpen(false);
      void navigate({ to: "/issue/$key", params: { key } });
    },
    togglePin: (key: string) => {
      const item = all.find((entry) => entry.key === key);
      if (item) update((current) => togglePinnedIssue(current, { key: item.key, summary: item.summary }));
    },
  };
}

export type WorkQueueState = ReturnType<typeof useWorkQueue>;
