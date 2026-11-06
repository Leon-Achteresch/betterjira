import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useFieldDraftStore } from "@/hooks/use-field-drafts";
import { useWorkspace } from "@/hooks/use-workspace";
import { RECENT_ISSUE_LIMIT, scopedFieldDraftKeys, togglePinnedIssue } from "@/lib/workspace";
import {
  filterWorkspaceEntries,
  workspaceEmptyState,
  workspaceEntries,
  workspaceFilterCounts,
  workspacePageFilterOf,
  workspacePageSearch,
  type WorkspaceEntry,
  type WorkspacePageFilter,
  type WorkspacePageSearch,
} from "@/lib/workspace-page";

export function useWorkspacePage(search: WorkspacePageSearch) {
  const { id, workspace, ready, update } = useWorkspace();
  const fieldDrafts = useFieldDraftStore((state) => state.drafts);
  const navigate = useNavigate({ from: "/arbeitsplatz" });
  const filter = workspacePageFilterOf(search.art);
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
    total: entries.length,
    counts: workspaceFilterCounts(entries),
    entries: filterWorkspaceEntries(entries, filter, query),
    emptyState: workspaceEmptyState(filter, query),
    recentLimit: RECENT_ISSUE_LIMIT,
    searchFor: (next: WorkspacePageFilter) => workspacePageSearch(next, query),
    changeQuery: (value: string) => {
      setQuery(value);
      setSyncedQuery(value);
      void navigate({ search: workspacePageSearch(filter, value), replace: true });
    },
    togglePin: (entry: WorkspaceEntry) =>
      update((current) => togglePinnedIssue(current, { key: entry.key, summary: entry.summary })),
  };
}

export type WorkspacePageState = ReturnType<typeof useWorkspacePage>;
