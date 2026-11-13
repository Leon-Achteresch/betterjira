import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useFieldDraftStore } from "@/hooks/use-field-drafts";
import { useKeyedFocus } from "@/hooks/use-keyed-focus";
import { useRecentRemoval } from "@/hooks/use-recent-removal";
import { useWorkspace } from "@/hooks/use-workspace";
import { RECENT_ISSUE_LIMIT, scopedFieldDraftKeys, togglePinnedIssue, type Workspace } from "@/lib/workspace";
import { useWorkspaceNoteEditor } from "@/hooks/use-workspace-note-editor";
import { usePersonalPlan } from "@/hooks/use-personal-plan";
import type { PlanBucket } from "@/lib/workspace-plan";
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
  const plan = usePersonalPlan();
  const orderedPlan = sort === "standard" && !query.trim() && (filter === "heute" || filter === "spaeter");

  return {
    ready,
    showBrowseAction: entries.length === 0 && !query.trim() && (filter === "alle" || filter === "zuletzt"),
    filter,
    query,
    sort,
    total: entries.length,
    counts: workspaceFilterCounts(entries),
    entries: visible,
    note,
    planFor: (entry: WorkspaceEntry, bucket: PlanBucket | null) => {
      plan.assign(entry, bucket);
      if (filter === "heute" || filter === "spaeter") requestAnimationFrame(() => focus(undefined));
    },
    movePlan: (entry: WorkspaceEntry, direction: -1 | 1) => plan.move(entry.key, direction),
    canMovePlan: (entry: WorkspaceEntry, direction: -1 | 1) => orderedPlan && (direction === -1 ? visible[0]?.key !== entry.key : visible.at(-1)?.key !== entry.key),
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
