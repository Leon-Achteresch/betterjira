import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useFieldDraftStore } from "@/hooks/use-field-drafts";
import { useWorkspace } from "@/hooks/use-workspace";
import { RECENT_ISSUE_LIMIT, scopedFieldDraftKeys, togglePinnedIssue } from "@/lib/workspace";
import {
  filterWorkspaceEntries,
  sortWorkspaceEntries,
  workspaceEmptyState,
  workspaceEntries,
  workspaceFilterCounts,
  workspacePageFilterOf,
  workspacePageSearch,
  workspacePageSortOf,
  type WorkspaceEntry,
  type WorkspacePageFilter,
  type WorkspacePageSearch,
} from "@/lib/workspace-page";

export function useWorkspacePage(search: WorkspacePageSearch) {
  const { id, workspace, ready, update } = useWorkspace();
  const fieldDrafts = useFieldDraftStore((state) => state.drafts);
  const navigate = useNavigate({ from: "/arbeitsplatz" });
  const filter = workspacePageFilterOf(search.art);
  const sort = workspacePageSortOf(search.sort);
  const urlQuery = search.q ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }
  const entries = workspaceEntries(workspace, scopedFieldDraftKeys(Object.keys(fieldDrafts), id));

  return {
    ready,
    filter,
    query,
    sort,
    total: entries.length,
    counts: workspaceFilterCounts(entries),
    entries: sortWorkspaceEntries(filterWorkspaceEntries(entries, filter, query), sort),
    emptyState: workspaceEmptyState(filter, query),
    recentLimit: RECENT_ISSUE_LIMIT,
    searchFor: (next: WorkspacePageFilter) => workspacePageSearch(next, query, sort),
    changeQuery: (value: string) => {
      setQuery(value);
      setSyncedQuery(value);
      void navigate({ search: workspacePageSearch(filter, value, sort), replace: true });
    },
    changeSort: (value: string) => {
      const next = workspacePageSortOf(value);
      if (next !== sort) void navigate({ search: workspacePageSearch(filter, query, next) });
    },
    togglePin: (entry: WorkspaceEntry) =>
      update((current) => togglePinnedIssue(current, { key: entry.key, summary: entry.summary })),
  };
}

export type WorkspacePageState = ReturnType<typeof useWorkspacePage>;
