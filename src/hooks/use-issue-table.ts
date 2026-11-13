import { useDebouncedValue } from "@tanstack/react-pacer";
import { Schema } from "effect";
import { useBulkEdit } from "@/hooks/jira/use-bulk-edit";
import { useJiraAccountScope } from "@/hooks/jira/use-jira-account-scope";
import { useTableSearch } from "@/hooks/use-interface-state";
import { preferenceScope } from "@/lib/interface-state";
import { legacyIssuePresentation } from "@/lib/view-preferences";
import { useFieldCatalog } from "@/hooks/jira/use-field-catalog";
import { useIssueCount } from "@/hooks/jira/use-issue-count";
import { useIssueSearch } from "@/hooks/jira/use-issue-search";
import { useIssueSelection } from "@/hooks/use-issue-selection";
import { useIssueViewTransfer } from "@/hooks/use-issue-view-transfer";
import { type SavedIssueView, useIssueViews } from "@/hooks/use-issue-views";
import { copyToClipboard } from "@/lib/clipboard";
import { fieldText } from "@/lib/jira/field-text";
import {
  DEFAULT_VIEW,
  FACETS,
  type Facet,
  KEY_COLUMN,
  QUICK_FILTERS,
  type QuickFilter,
  collectFacetOptions,
  columnLabel,
  facetCount,
  moveValue,
  pickableFields,
  sortClauseOf,
  toggleValue,
} from "@/lib/jira/issue-view";
import { type SortDirection, composeJql, cycleSort, textClause, valuesClause } from "@/lib/jira/jql";
import { toMarkdown, toTsv } from "@/lib/table-export";
import { groupIssues, issueGridEntries, IssueGrouping } from "@/lib/jira/issue-grouping";

const FACET_KEYS = Object.keys(FACETS) as Facet[];
const NO_SAVED_VIEWS: SavedIssueView[] = [];

export type ExportFormat = "tsv" | "markdown" | "keys" | "jql";

export type IssueTableText = { value: string; onChange: (text: string) => void; placeholder: string };

export function useIssueTable(scope: string, baseJql: string, externalText?: IssueTableText) {
  const account = useJiraAccountScope();
  const preferenceKey = account.scope === null ? null : preferenceScope(account.scope, scope);
  const stored = useIssueViews((state) => preferenceKey === null ? undefined : state.views[preferenceKey]);
  const legacy = useIssueViews((state) => state.views[scope]);
  const presentation = legacyIssuePresentation(legacy);
  const savedViews = useIssueViews((state) => preferenceKey === null ? undefined : state.saved[preferenceKey]) ?? NO_SAVED_VIEWS;
  const storedUpdate = useIssueViews((state) => state.update);
  const storedSave = useIssueViews((state) => state.save);
  const storedRemove = useIssueViews((state) => state.remove);
  const update = (_scope: string, change: Parameters<typeof storedUpdate>[1]) => {
    if (preferenceKey !== null) storedUpdate(preferenceKey, change, presentation);
  };
  const reset = (_scope: string) => { if (preferenceKey !== null) storedUpdate(preferenceKey, () => DEFAULT_VIEW); };
  const save = (_scope: string, name: string) => { if (preferenceKey !== null) storedSave(preferenceKey, name, presentation); };
  const remove = (_scope: string, name: string) => { if (preferenceKey !== null) storedRemove(preferenceKey, name); };
  const view = { ...DEFAULT_VIEW, ...presentation, ...stored };
  const transfer = useIssueViewTransfer(view, (imported) => update(scope, () => ({ ...DEFAULT_VIEW, groupBy: "none", collapsedGroups: [], ...imported })));
  const groupBy = view.groupBy ?? "none";
  const quick = view.quick.filter((key) => key in QUICK_FILTERS);

  const searchText = useTableSearch(scope);
  const text = externalText?.value ?? searchText.text;
  const setText = externalText?.onChange ?? searchText.setText;
  const searchPrefix = `${preferenceKey ?? ""}\u0000`;
  const [debouncedSearch] = useDebouncedValue(`${searchPrefix}${externalText ? "" : searchText.text.trim()}`, { wait: 300 });
  const debouncedText = debouncedSearch.startsWith(searchPrefix) ? debouncedSearch.slice(searchPrefix.length) : "";

  const clauses = [
    ...quick.map((key) => QUICK_FILTERS[key].jql),
    ...FACET_KEYS.map((facet) => valuesClause(facet, view.facets[facet] ?? [])),
    textClause(debouncedText),
  ];
  const jql = composeJql(baseJql, clauses, view.sort);
  const fields = [...new Set(["summary", "status", ...groupBy === "none" ? [] : [groupBy], ...view.columns.filter((column) => column !== KEY_COLUMN)])];

  const catalog = useFieldCatalog();
  const fieldById = new Map((catalog.data ?? []).map((field) => [field.id, field]));
  const search = useIssueSearch(jql, fields);
  const count = useIssueCount(jql);
  const facetSource = useIssueSearch(composeJql(baseJql, []), FACET_KEYS, 100);

  const issues = search.data?.pages.flatMap((page) => page.issues) ?? [];
  const groups = groupIssues(issues, groupBy);
  const entries = issueGridEntries(issues, groups, groupBy, view.collapsedGroups ?? []);
  const isPlaceholder = search.isPlaceholderData;
  const selection = useIssueSelection(JSON.stringify([preferenceKey, scope, jql]), issues);
  const bulk = useBulkEdit(selection.selected.map(({ key }) => key), isPlaceholder);
  const canLoadMore = search.hasNextPage && !isPlaceholder && !search.isFetching;
  const facetIssues = facetSource.data?.pages[0]?.issues ?? [];

  const columns = view.columns.map((id) => {
    const field = fieldById.get(id);
    const sortField = sortClauseOf(id, field);
    const sortIndex = sortField ? view.sort.findIndex((entry) => entry.field === sortField) : -1;
    return {
      id,
      label: columnLabel(id, field),
      sortable: !!sortField,
      direction: sortIndex >= 0 ? view.sort[sortIndex]!.direction : undefined,
      sortIndex: view.sort.length > 1 && sortIndex >= 0 ? sortIndex + 1 : undefined,
    };
  });

  const facets = FACET_KEYS.map((facet) => ({
    id: facet,
    label: FACETS[facet],
    selected: view.facets[facet] ?? [],
    options: collectFacetOptions(facet, facetIssues, view.facets[facet]),
  }));

  const cellText = (issue: (typeof issues)[number], column: string) =>
    column === KEY_COLUMN ? issue.key : fieldText(issue.fields[column]);

  const exportAs = async (format: ExportFormat, selectedOnly = false) => {
    const exported = selectedOnly ? selection.selected : issues;
    if (format === "jql") return copyToClipboard(jql, "JQL kopiert");
    if (isPlaceholder) return;
    if (format === "keys") return copyToClipboard(exported.map((issue) => issue.key).join(", "), `${exported.length} Schlüssel kopiert`);
    const header = columns.map((column) => column.label);
    const rows = exported.map((issue) => view.columns.map((column) => cellText(issue, column)));
    const content = format === "tsv" ? toTsv(header, rows) : toMarkdown(header, rows);
    return copyToClipboard(content, `${exported.length} Zeilen kopiert`);
  };

  const filterCount = quick.length + facetCount(view.facets);

  return {
    scope,
    transfer,
    bulk,
    selection: {
      ...selection,
      toggle: (key: string) => {
        if (!isPlaceholder && !bulk.pending) selection.toggle(key);
      },
      toggleAll: () => {
        if (!isPlaceholder && !bulk.pending) selection.toggleAll();
      },
    },
    jql,
    issues,
    entries,
    groupBy,
    hasCollapsedGroups: groups.some((group) => view.collapsedGroups?.includes(group.id)),
    toggleGroup: (id: string) => update(scope, (current) => ({ collapsedGroups: toggleValue(current.collapsedGroups ?? [], id) })),
    setGrouping: (groupBy: string) => { if (Schema.is(IssueGrouping)(groupBy)) update(scope, () => ({ groupBy })); },
    expandGroups: () => update(scope, () => ({ collapsedGroups: [] })),
    collapseGroups: () => update(scope, (current) => ({ collapsedGroups: [...new Set([...(current.collapsedGroups ?? []), ...groups.map((group) => group.id)])] })),
    columns,
    dense: view.dense,
    quick,
    facets,
    text,
    textPlaceholder: externalText?.placeholder ?? "In Ergebnissen suchen",
    filterCount,
    savedViews,
    availableFields: pickableFields(catalog.data ?? []),
    columnIds: view.columns,
    total: count.data?.count,
    error: search.data ? null : search.error,
    refreshError: search.isRefetchError ? search.error : null,
    loadMoreError: search.isFetchNextPageError ? search.error : null,
    isPlaceholder,
    isPending: search.isPending,
    isFetching: search.isFetching && !search.isFetchingNextPage,
    hasMore: search.hasNextPage,
    canLoadMore,
    isLoadingMore: search.isFetchingNextPage,
    loadMore: () => {
      if (canLoadMore) void search.fetchNextPage();
    },
    refresh: () => void Promise.all([search.refetch(), count.refetch()]),
    setText,
    toggleSort: (column: string, additive: boolean) => {
      const field = sortClauseOf(column, fieldById.get(column));
      if (field) update(scope, ({ sort }) => ({ sort: cycleSort(sort, field, additive) }));
    },
    setSortDirection: (column: string, direction: SortDirection | undefined) => {
      const field = sortClauseOf(column, fieldById.get(column));
      if (!field) return;
      update(scope, ({ sort }) => ({ sort: direction ? [{ field, direction }] : sort.filter((entry) => entry.field !== field) }));
    },
    toggleColumn: (column: string) => update(scope, ({ columns }) => ({ columns: toggleValue(columns, column) })),
    moveColumn: (column: string, offset: number) => update(scope, ({ columns }) => ({ columns: moveValue(columns, column, offset) })),
    setColumns: (columns: string[]) => update(scope, () => ({ columns })),
    toggleQuick: (key: QuickFilter) => update(scope, (current) => ({ quick: toggleValue(current.quick, key) })),
    toggleFacet: (facet: Facet, value: string) =>
      update(scope, ({ facets }) => ({ facets: { ...facets, [facet]: toggleValue(facets[facet] ?? [], value) } })),
    clearFilters: () => {
      setText("");
      update(scope, () => ({ quick: [], facets: {} }));
    },
    setDense: (dense: boolean) => update(scope, () => ({ dense })),
    resetView: () => reset(scope),
    saveView: (name: string) => save(scope, name),
    applyView: ({ name: _, ...saved }: SavedIssueView) => update(scope, () => ({ ...DEFAULT_VIEW, ...saved })),
    removeView: (name: string) => remove(scope, name),
    exportAs,
  };
}

export type IssueTableState = ReturnType<typeof useIssueTable>;
