import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type BoardFilter, type BoardView, type FilterField, boardScopes, otherScopes } from "@/lib/board-filters";

type BoardFiltersState = {
  filters: Record<string, BoardFilter>;
  ignoreBoard: Record<string, boolean>;
  views: Record<string, BoardView[]>;
  toggle: (scope: string, field: FilterField, value: string) => void;
  toggleIgnoreBoard: (scope: string) => void;
  clear: (scope: string) => void;
  saveView: (board: string, name: string) => void;
  applyView: (board: string, view: BoardView) => void;
  deleteView: (board: string, name: string) => void;
};

export const useBoardFilters = create<BoardFiltersState>()(
  persist(
    (set) => ({
      filters: {},
      ignoreBoard: {},
      views: {},
      toggle: (scope, field, value) =>
        set(({ filters }) => {
          const current = filters[scope]?.[field] ?? [];
          const next = current.includes(value) ? current.filter((x) => x !== value) : [...current, value];
          return { filters: { ...filters, [scope]: { ...filters[scope], [field]: next } } };
        }),
      toggleIgnoreBoard: (scope) =>
        set(({ ignoreBoard }) => ({ ignoreBoard: { ...ignoreBoard, [scope]: !ignoreBoard[scope] } })),
      clear: (scope) =>
        set(({ filters, ignoreBoard }) => {
          const { [scope]: _, ...rest } = filters;
          const { [scope]: __, ...restIgnore } = ignoreBoard;
          return { filters: rest, ignoreBoard: restIgnore };
        }),
      saveView: (board, name) =>
        set(({ filters, ignoreBoard, views }) => {
          const view = { name, filters: boardScopes(filters, board), ignoreBoard: boardScopes(ignoreBoard, board) };
          const others = (views[board] ?? []).filter((existing) => existing.name !== name);
          return { views: { ...views, [board]: [...others, view] } };
        }),
      applyView: (board, view) =>
        set(({ filters, ignoreBoard }) => ({
          filters: { ...otherScopes(filters, board), ...view.filters },
          ignoreBoard: { ...otherScopes(ignoreBoard, board), ...view.ignoreBoard },
        })),
      deleteView: (board, name) =>
        set(({ views }) => ({ views: { ...views, [board]: (views[board] ?? []).filter((view) => view.name !== name) } })),
    }),
    { name: "betterjira-board-filters" },
  ),
);
