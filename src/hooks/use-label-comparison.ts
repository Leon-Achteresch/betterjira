import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLatestRef } from "./use-latest-ref";
import { collectComparisonLabels, compareLabelVariants, LABEL_COMPARISON_LIMITS } from "@/lib/jira/label-comparison";
import { jiraQueryScopeMatches, type JiraQueryScope } from "@/lib/jira/query-scope";
import type { SearchIssue } from "@/lib/jira/search";

export function useLabelComparison(input: {
  context: string; scope: JiraQueryScope | undefined; ready: boolean; accountLabel: string;
  issues: readonly SearchIssue[]; selected: readonly SearchIssue[]; hasMore: boolean; readError: boolean;
}) {
  const client = useQueryClient();
  const context = JSON.stringify([input.context, input.scope, input.ready, input.selected.map(({ id, key }) => [id, key])]);
  const [state, setState] = useState({ context, token: Symbol(), open: false, reference: "" });
  const current = state.context === context ? state : { context, token: Symbol(), open: false, reference: "" };
  if (current !== state) setState(current);
  const latest = useLatestRef(current);
  const allowed = input.ready && jiraQueryScopeMatches(client, input.scope);
  const validAction = () => latest.current.token === current.token && input.ready && jiraQueryScopeMatches(client, input.scope);
  const source = input.selected.length ? input.selected : input.issues;
  const inventory = collectComparisonLabels(current.open && allowed ? source : []);
  const comparison = compareLabelVariants(inventory.labels, current.reference);
  return {
    open: current.open && allowed && source.length > 0,
    disabled: !allowed || source.length === 0,
    setOpen: (open: boolean) => { if (latest.current.token === current.token && (!open || (validAction() && source.length > 0))) setState((previous) => ({ ...previous, open })); },
    reference: comparison.selected?.label ?? null,
    setReference: (reference: string | null) => {
      if (validAction() && current.open && (reference === null || inventory.labels.some((entry) => entry.label === reference))) setState((previous) => ({ ...previous, reference: reference ?? "" }));
    },
    sourceLabel: input.selected.length ? "ausgewählte geladene Tickets" : "geladene Treffer der aktuellen Suche",
    accountLabel: input.accountLabel,
    hasMore: input.hasMore,
    readError: input.readError,
    inventory,
    labels: inventory.labels.map((entry) => entry.label),
    comparison,
    limits: LABEL_COMPARISON_LIMITS,
  };
}
export type LabelComparisonState = ReturnType<typeof useLabelComparison>;
