import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useJiraAccountScope } from "@/hooks/jira/use-jira-account-scope";
import { LOCAL_PREFERENCE_STORAGE } from "@/lib/local-preference-storage";
import { boardPreferencePrefix, readBoardFilters, scopedBoardPreferences, scopedBoardView } from "@/lib/view-preferences";
import { type BoardFilter, type BoardView, type FilterField, boardScopes, otherScopes } from "@/lib/board-filters";

type BoardFiltersState = {
  filters: Record<string, BoardFilter>;
  ignoreBoard: Record<string, boolean>;
  views: Record<string, BoardView[]>;
  hiddenColumns: Record<string, string[]>;
  toggle: (scope: string, field: FilterField, value: string) => void;
  toggleIgnoreBoard: (scope: string) => void;
  clear: (scope: string) => void;
  saveView: (board: string, name: string) => void;
  applyView: (board: string, view: BoardView) => void;
  deleteView: (board: string, name: string) => void;
  toggleColumn: (board: string, column: string) => void;
};

export const useBoardFiltersStore = create<BoardFiltersState>()(
  persist(
    (set) => ({
      filters: {},
      ignoreBoard: {},
      views: {},
      hiddenColumns: {},
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
      toggleColumn: (board, column) =>
        set(({ hiddenColumns }) => {
          const hidden = hiddenColumns[board] ?? [];
          const next = hidden.includes(column) ? hidden.filter((name) => name !== column) : [...hidden, column];
          return { hiddenColumns: { ...hiddenColumns, [board]: next } };
        }),
    }),
    {
      name: "betterjira-board-filters",
      version: 1,
      storage: createJSONStorage(() => LOCAL_PREFERENCE_STORAGE),
      partialize: ({ filters, ignoreBoard, views, hiddenColumns }) => ({ filters, ignoreBoard, views, hiddenColumns }),
      migrate: (persisted) => readBoardFilters(persisted),
      merge: (persisted, current) => ({ ...current, ...readBoardFilters(persisted) }),
    },
  ),
);

export function useBoardFilters<T>(selector: (state: BoardFiltersState) => T): T {
  const { scope } = useJiraAccountScope();
  const stored = useBoardFiltersStore();
  const scoped = useMemo<BoardFiltersState>(() => {
    const prefix = scope === null ? null : boardPreferencePrefix(scope);
    const qualify = (key: string) => `${prefix}${key}`;
    const views = scopedBoardPreferences(stored.views, scope);
    return {
      filters: scopedBoardPreferences(stored.filters, scope),
      ignoreBoard: scopedBoardPreferences(stored.ignoreBoard, scope),
      hiddenColumns: scopedBoardPreferences(stored.hiddenColumns, scope),
      views: Object.fromEntries(Object.entries(views).map(([board, entries]) => [board, entries.map((view) => scopedBoardView(view, scope))])),
      toggle: (board, field, value) => { if (prefix !== null) stored.toggle(qualify(board), field, value); },
      toggleIgnoreBoard: (board) => { if (prefix !== null) stored.toggleIgnoreBoard(qualify(board)); },
      clear: (board) => { if (prefix !== null) stored.clear(qualify(board)); },
      saveView: (board, name) => { if (prefix !== null) stored.saveView(qualify(board), name); },
      applyView: (board, view) => {
        if (prefix === null) return;
        stored.applyView(qualify(board), {
          ...view,
          filters: Object.fromEntries(Object.entries(view.filters).map(([key, value]) => [qualify(key), value])),
          ignoreBoard: Object.fromEntries(Object.entries(view.ignoreBoard).map(([key, value]) => [qualify(key), value])),
        });
      },
      deleteView: (board, name) => { if (prefix !== null) stored.deleteView(qualify(board), name); },
      toggleColumn: (board, column) => { if (prefix !== null) stored.toggleColumn(qualify(board), column); },
    };
  }, [stored, scope]);
  return selector(scoped);
}
