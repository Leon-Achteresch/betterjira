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
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const results = useMemo(() => searchRollouts(rollouts, text.text), [rollouts, text.text]);
  const expanded = expandedFor === text.text;

  return {
    text: text.text,
    setText: text.setText,
    status: rolloutSearchStatus({ query: text.text, pending, loaded }),
    results: expanded ? results : results.slice(0, ROLLOUT_SEARCH_LIMIT),
    total: results.length,
    canExpand: results.length > ROLLOUT_SEARCH_LIMIT,
    expanded,
    toggleExpanded: () => setExpandedFor(expanded ? null : text.text),
    agendaRef,
    open: (rollout: Rollout) => {
      onOpen(rollout);
      agendaRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    },
  };
}

export type RolloutSearchState = ReturnType<typeof useRolloutSearch>;
