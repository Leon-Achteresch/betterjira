export const FILTER_FIELDS = { assignee: "Bearbeiter", issuetype: "Typ", priority: "Priorität", label: "Label" } as const;

export type FilterField = keyof typeof FILTER_FIELDS;
export type BoardFilter = Partial<Record<FilterField, string[]>>;
export type FilterValues = Record<FilterField, readonly string[]>;

export type BoardView = {
  name: string;
  filters: Record<string, BoardFilter>;
  ignoreBoard: Record<string, boolean>;
};

export const UNASSIGNED = "Nicht zugewiesen";

export const EMPTY_FILTER: BoardFilter = {};

export const EMPTY_VIEWS: BoardView[] = [];

export const matchesFilter = (filter: BoardFilter, values: FilterValues) =>
  (Object.keys(filter) as FilterField[]).every((field) => {
    const selected = filter[field];
    return !selected?.length || values[field].some((value) => selected.includes(value));
  });

export const filterCount = (filter: BoardFilter) =>
  Object.values(filter).reduce((sum, selected) => sum + (selected?.length ?? 0), 0);

const inBoard = (scope: string, board: string) => scope === board || scope.startsWith(`${board}:`);

export const boardScopes = <T>(record: Record<string, T>, board: string) =>
  Object.fromEntries(Object.entries(record).filter(([scope]) => inBoard(scope, board)));

export const otherScopes = <T>(record: Record<string, T>, board: string) =>
  Object.fromEntries(Object.entries(record).filter(([scope]) => !inBoard(scope, board)));
