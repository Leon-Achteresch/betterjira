import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useFieldDraftStore } from "@/hooks/use-field-drafts";
import { useKeyedFocus } from "@/hooks/use-keyed-focus";
import { useRecentRemoval } from "@/hooks/use-recent-removal";
import { useWorkspace } from "@/hooks/use-workspace";
import { RECENT_ISSUE_LIMIT, scopedFieldDraftKeys, togglePinnedIssue, type Workspace } from "@/lib/workspace";
import { useWorkspaceNoteEditor } from "@/hooks/use-workspace-note-editor";
import { RECENT_ISSUE_LIMIT, scopedFieldDraftKeys, togglePinnedIssue } from "@/lib/workspace";
import {
  visibleWorkspaceEntries,
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
  const draftKeys = useMemo(() => scopedFieldDraftKeys(Object.keys(fieldDrafts), id), [fieldDrafts, id]);
  const visibleOf = useCallback(
    (from: Workspace) => visibleWorkspaceEntries(workspaceEntries(from, draftKeys), filter, query, sort),
    [draftKeys, filter, query, sort],
  );
  const { refFor, fallbackRef, focus } = useKeyedFocus();
  const removeRecent = useRecentRemoval(id, visibleOf, focus);
  const entries = workspaceEntries(workspace, draftKeys);
  const visible = visibleWorkspaceEntries(entries, filter, query, sort);
  const note = useWorkspaceNoteEditor(visible);

  return {
    ready,
    filter,
    query,
    sort,
    total: entries.length,
    counts: workspaceFilterCounts(entries),
    entries: visible,
    note,
    emptyState: workspaceEmptyState(filter, query),
    recentLimit: RECENT_ISSUE_LIMIT,
    entryRef: refFor,
    searchRef: fallbackRef,
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
    removeRecent: (entry: WorkspaceEntry) => removeRecent(entry.key),
  };
}

export type WorkspacePageState = ReturnType<typeof useWorkspacePage>;
