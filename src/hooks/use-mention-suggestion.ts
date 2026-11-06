import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import type { MentionSuggestion } from "@/components/adf-editor";
import { useActiveOption } from "@/components/motion/combobox/use-active-option";
import { useMentionSearch } from "@/hooks/jira/use-mention-search";
import { rankMentionCandidates, type MentionCandidate } from "@/lib/jira/people";
import { listboxOptionId } from "@/lib/listbox";

type MentionAttrs = { id: string; label: string };

type MentionQuery = {
  query: string;
  from: number;
  rect: () => DOMRect | null;
  insert: (candidate: MentionCandidate) => void;
};

const SEARCH_DELAY_MS = 200;

const toQuery = (props: SuggestionProps<MentionCandidate, MentionAttrs>): MentionQuery => ({
  query: props.query,
  from: props.range.from,
  rect: () => props.clientRect?.() ?? null,
  insert: (candidate) => props.command({ id: candidate.accountId, label: `@${candidate.displayName}` }),
});

const mentionStatus = (failed: boolean, empty: boolean, searching: boolean) => {
  if (failed) return "Suche gerade nicht möglich";
  if (!empty) return undefined;
  return searching ? "Suche läuft …" : "Keine Person gefunden";
};

export function useMentionSuggestion({
  listId,
  issueKey,
  participants,
}: {
  listId: string;
  issueKey: string;
  participants: readonly MentionCandidate[];
}) {
  const [current, setCurrent] = useState<MentionQuery | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const query = current?.query.trim() ?? "";
  const [debounced] = useDebouncedValue(query, { wait: SEARCH_DELAY_MS });
  const search = useMentionSearch(issueKey, current ? debounced : "");
  const open = current !== null && current.from !== dismissedAt;
  const candidates = rankMentionCandidates(query, participants, search.data ?? []);
  const { activeValue, setActiveValue, moveActive } = useActiveOption({
    open,
    query,
    value: undefined,
    enabledItems: candidates.map((candidate) => ({ value: candidate.accountId })),
  });
  const active = candidates.find((candidate) => candidate.accountId === activeValue);
  const select = (candidate: MentionCandidate) => current?.insert(candidate);

  const openRef = useRef(false);
  const keyHandler = useRef<(event: KeyboardEvent) => boolean>(() => false);
  useLayoutEffect(() => {
    openRef.current = open;
    keyHandler.current = (event) => {
      if (!open || event.isComposing) return false;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        moveActive(event.key === "ArrowDown" ? 1 : -1);
        return true;
      }
      if ((event.key === "Enter" || event.key === "Tab") && active) {
        current?.insert(active);
        return true;
      }
      if (event.key === "Escape") {
        event.stopPropagation();
        setDismissedAt(current?.from ?? null);
        return true;
      }
      return false;
    };
  });

  const [suggestion] = useState<MentionSuggestion>(() => ({
    char: "@",
    allowSpaces: false,
    items: () => [],
    render: () => ({
      onStart: (props: SuggestionProps<MentionCandidate, MentionAttrs>) => setCurrent(toQuery(props)),
      onUpdate: (props: SuggestionProps<MentionCandidate, MentionAttrs>) => setCurrent(toQuery(props)),
      onExit: () => {
        setCurrent(null);
        setDismissedAt(null);
      },
      onKeyDown: ({ event }: SuggestionKeyDownProps) => keyHandler.current(event),
    }),
  }));

  const activeId = open && activeValue ? listboxOptionId(listId, activeValue) : undefined;
  const aria = useMemo<Record<string, string | undefined>>(
    () => (open ? { "aria-controls": listId, "aria-autocomplete": "list", "aria-activedescendant": activeId } : {}),
    [open, listId, activeId],
  );

  return {
    suggestion,
    isOpen: () => openRef.current,
    aria,
    list: {
      open,
      anchor: current?.rect ?? null,
      candidates,
      activeValue,
      setActiveValue,
      select,
      status: mentionStatus(search.isError, candidates.length === 0, query.length > 0 && (debounced !== query || search.isFetching)),
    },
  };
}
