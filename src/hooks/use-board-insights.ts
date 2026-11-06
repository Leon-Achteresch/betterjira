import { useMemo } from "react";
import { type BoardColumn, cardValues, insightItem } from "@/lib/board-card";
import { EMPTY_COLUMNS, FILTER_FIELDS, type FilterField, columnMatches } from "@/lib/board-filters";
import { EMPTY_VALUES, boardInsights } from "@/lib/board-insights";
import { useBoardDisplay } from "@/hooks/use-board-display";
import { useBoardFilters } from "@/hooks/use-board-filters";

const isFilterField = (field: string): field is FilterField => field in FILTER_FIELDS;

export function useBoardInsights(boardId: number, columns: readonly BoardColumn[]) {
  const display = useBoardDisplay();
  const filters = useBoardFilters((state) => state.filters);
  const ignoreBoard = useBoardFilters((state) => state.ignoreBoard);
  const hidden = useBoardFilters((state) => state.hiddenColumns[boardId] ?? EMPTY_COLUMNS);
  const toggleFilter = useBoardFilters((state) => state.toggle);

  const { insights, statusColors, count } = useMemo(() => {
    const visible = columns
      .filter((column) => !hidden.includes(column.name))
      .flatMap((column) =>
        column.issues.filter((issue) => columnMatches(filters, ignoreBoard, boardId, column.name, cardValues(issue))),
      );
    const statuses = new Map(visible.map((issue) => [issue.fields.status.name, issue.fields.status.statusCategory.colorName]));
    return {
      count: visible.length,
      statusColors: Object.fromEntries(statuses),
      insights: boardInsights(visible.map(insightItem), display.measure, display.slice, display.segment, {
        status: [...statuses.keys()],
      }),
    };
  }, [columns, hidden, filters, ignoreBoard, boardId, display.measure, display.slice, display.segment]);

  const field = isFilterField(display.slice) ? display.slice : undefined;
  const active = field ? (filters[boardId]?.[field] ?? []) : [];
  const canFilter = (name: string) => !!field && (name !== EMPTY_VALUES[field] || field === "assignee");

  return {
    ...display,
    insights,
    count,
    statusColors,
    active,
    canFilter,
    toggleRow: (name: string) => field && canFilter(name) && toggleFilter(String(boardId), field, name),
  };
}
