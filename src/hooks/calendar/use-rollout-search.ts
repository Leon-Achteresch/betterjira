import { useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useNavigate } from "@tanstack/react-router";
import { useUrlText } from "@/hooks/search/use-url-text";
import type { Rollout } from "@/lib/calendar/model";
import { ROLLOUT_SEARCH_LIMIT, rolloutSearchStatus, searchRollouts, type KalenderSearch } from "@/lib/calendar/rollout-search";

type RolloutSource = {
  rollouts: readonly Rollout[];
  pending: boolean;
  loaded: boolean;
  onOpen: (rollout: Rollout) => void;
};

export function useRolloutSearch(search: KalenderSearch, { rollouts, pending, loaded, onOpen }: RolloutSource) {
  const navigate = useNavigate({ from: "/kalender" });
  const reduce = useReducedMotion();
  const agendaRef = useRef<HTMLElement>(null);
  const text = useUrlText(search.q ?? "", (q) => void navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true }));
  const [expansion, setExpansion] = useState({ query: text.text, expanded: false });
  if (expansion.query !== text.text) setExpansion({ query: text.text, expanded: false });
  const results = useMemo(() => searchRollouts(rollouts, text.text), [rollouts, text.text]);
  const expanded = expansion.query === text.text && expansion.expanded;

  return {
    text: text.text,
    setText: text.setText,
    status: rolloutSearchStatus({ query: text.text, pending, loaded }),
    results: expanded ? results : results.slice(0, ROLLOUT_SEARCH_LIMIT),
    total: results.length,
    canExpand: results.length > ROLLOUT_SEARCH_LIMIT,
    expanded,
    toggleExpanded: () => setExpansion({ query: text.text, expanded: !expanded }),
    agendaRef,
    open: (rollout: Rollout) => {
      onOpen(rollout);
      agendaRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    },
  };
}

export type RolloutSearchState = ReturnType<typeof useRolloutSearch>;
