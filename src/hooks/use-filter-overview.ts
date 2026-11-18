import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useFilterFavourite, useFilterFavouritePending } from "@/hooks/jira/use-jira-filter";
import {
  filterOverviewCounts,
  filterOverviewEmptyState,
  filterOverviewSearch,
  filterOverviewStatus,
  filterOverviewViewOf,
  visibleFilters,
  type FilterOverviewSearch,
  type FilterOverviewView,
} from "@/lib/filter-overview";
import { jiraErrorText } from "@/lib/jira/field-values";
import { useJiraFilters, type JiraFilter } from "@/lib/jira/queries";

export function useFilterOverview(search: FilterOverviewSearch) {
  const filters = useJiraFilters();
  const favourite = useFilterFavourite();
  const pending = useFilterFavouritePending();
  const navigate = useNavigate({ from: "/filter/" });
  const view = filterOverviewViewOf(search.ansicht);
  const urlQuery = search.q ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }
  const all = filters.data ?? [];
  const error = filters.error ?? filters.scopeError;

  const toggleFavourite = (filter: JiraFilter, next = !filter.favourite) => {
    if (pending.isPending(filter.id)) return;
    favourite.mutate(
      { id: filter.id, favourite: next },
      {
        onSuccess: () => {
          if (!next)
            toast.success(`„${filter.name}“ aus Favoriten entfernt`, {
              action: { label: "Rückgängig", onClick: () => toggleFavourite(filter, true) },
            });
        },
        onError: (error) =>
          toast.error(`Favorit für „${filter.name}“ konnte nicht geändert werden`, { description: jiraErrorText(error) }),
      },
    );
  };

  return {
    view,
    query,
    status: filterOverviewStatus({ hasData: !!filters.data, isError: !!error }),
    errorText: error ? jiraErrorText(error) : "",
    retrying: filters.isFetching || filters.checkingScope,
    retry: () => void (filters.scopeError ? filters.retryScope() : filters.refetch()),
    contentSearch: filters.scope && filters.data && !error
      ? { context: JSON.stringify(filters.scope), filters: filters.data }
      : null,
    counts: filterOverviewCounts(all),
    filters: visibleFilters(all, view, query),
    pendingIds: pending.ids,
    emptyState: filterOverviewEmptyState(view, query),
    searchFor: (next: FilterOverviewView) => filterOverviewSearch(next, query),
    changeQuery: (value: string) => {
      setQuery(value);
      setSyncedQuery(value);
      void navigate({ search: filterOverviewSearch(view, value), replace: true });
    },
    toggleFavourite: (filter: JiraFilter) => toggleFavourite(filter),
  };
}

export type FilterOverviewState = ReturnType<typeof useFilterOverview>;
