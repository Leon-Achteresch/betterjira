import { useState } from "react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useFieldCatalog } from "@/hooks/jira/use-field-catalog";
import { useIssueCount } from "@/hooks/jira/use-issue-count";
import { useIssueSearch } from "@/hooks/jira/use-issue-search";
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

const FACET_KEYS = Object.keys(FACETS) as Facet[];
const NO_SAVED_VIEWS: SavedIssueView[] = [];

export type ExportFormat = "tsv" | "markdown" | "keys" | "jql";

export function useIssueTable(scope: string, baseJql: string) {
  const stored = useIssueViews((state) => state.views[scope]);
  const savedViews = useIssueViews((state) => state.saved[scope]) ?? NO_SAVED_VIEWS;
  const update = useIssueViews((state) => state.update);
  const reset = useIssueViews((state) => state.reset);
  const save = useIssueViews((state) => state.save);
  const remove = useIssueViews((state) => state.remove);
  const view = { ...DEFAULT_VIEW, ...stored };
  const quick = view.quick.filter((key) => key in QUICK_FILTERS);

  const [text, setText] = useState("");
  const [debouncedText] = useDebouncedValue(text.trim(), { wait: 300 });

  const clauses = [
    ...quick.map((key) => QUICK_FILTERS[key].jql),
    ...FACET_KEYS.map((facet) => valuesClause(facet, view.facets[facet] ?? [])),
    textClause(debouncedText),
  ];
  const jql = composeJql(baseJql, clauses, view.sort);
  const fields = ["summary", "status", ...view.columns.filter((column) => column !== KEY_COLUMN && column !== "summary" && column !== "status")];

  const catalog = useFieldCatalog();
  const fieldById = new Map((catalog.data ?? []).map((field) => [field.id, field]));
  const search = useIssueSearch(jql, fields);
  const count = useIssueCount(jql);
  const facetSource = useIssueSearch(composeJql(baseJql, []), FACET_KEYS, 100);

  const issues = search.data?.pages.flatMap((page) => page.issues) ?? [];
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

  const exportAs = (format: ExportFormat) => {
    if (format === "jql") return copyToClipboard(jql, "JQL kopiert");
    if (format === "keys") return copyToClipboard(issues.map((issue) => issue.key).join(", "), `${issues.length} Schlüssel kopiert`);
    const header = columns.map((column) => column.label);
    const rows = issues.map((issue) => view.columns.map((column) => cellText(issue, column)));
    const content = format === "tsv" ? toTsv(header, rows) : toMarkdown(header, rows);
    return copyToClipboard(content, `${issues.length} Zeilen kopiert`);
  };

  const filterCount = quick.length + facetCount(view.facets);

  return {
    scope,
    jql,
    issues,
    columns,
    dense: view.dense,
    quick,
    facets,
    text,
    filterCount,
    savedViews,
    availableFields: pickableFields(catalog.data ?? []),
    columnIds: view.columns,
    total: count.data?.count,
    error: search.error,
    isPending: search.isPending,
    isFetching: search.isFetching && !search.isFetchingNextPage,
    hasMore: search.hasNextPage,
    isLoadingMore: search.isFetchingNextPage,
    loadMore: () => void search.fetchNextPage(),
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
    applyView: ({ name: _, ...saved }: SavedIssueView) => update(scope, () => saved),
    removeView: (name: string) => remove(scope, name),
    exportAs,
  };
}

export type IssueTableState = ReturnType<typeof useIssueTable>;
