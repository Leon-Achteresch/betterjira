import { matchesNeedle, normalizeNeedle } from "@/lib/sidebar-search";

export const PROJECT_VIEWS = {
  alle: { label: "Alle" },
  favoriten: { label: "Favoriten" },
} as const;

export type ProjectView = keyof typeof PROJECT_VIEWS;

export const PROJECT_VIEW_IDS = Object.keys(PROJECT_VIEWS) as ProjectView[];

const DEFAULT_PROJECT_VIEW: ProjectView = "alle";

export const PROJECT_SORTS = {
  standard: { label: "Standard" },
  name: { label: "Name A–Z" },
  schluessel: { label: "Schlüssel" },
  favoriten: { label: "Favoriten zuerst" },
} as const;

export type ProjectSort = keyof typeof PROJECT_SORTS;

export const PROJECT_SORT_IDS = Object.keys(PROJECT_SORTS) as ProjectSort[];

const DEFAULT_PROJECT_SORT: ProjectSort = "standard";

const MAX_QUERY_LENGTH = 200;

export type ProjectDirectorySearch = { q?: string; ansicht?: ProjectView; sort?: ProjectSort };

export const projectViewOf = (value: unknown): ProjectView =>
  PROJECT_VIEW_IDS.find((id) => id === value) ?? DEFAULT_PROJECT_VIEW;

export const projectSortOf = (value: unknown): ProjectSort =>
  PROJECT_SORT_IDS.find((id) => id === value) ?? DEFAULT_PROJECT_SORT;

export const projectDirectorySearch = ({
  q,
  ansicht,
  sort,
}: {
  q?: unknown;
  ansicht?: unknown;
  sort?: unknown;
}): ProjectDirectorySearch => {
  const view = projectViewOf(ansicht);
  const order = projectSortOf(sort);
  const query = typeof q === "string" ? q.slice(0, MAX_QUERY_LENGTH) : "";
  return {
    q: query.trim() !== "" ? query : undefined,
    ansicht: view !== DEFAULT_PROJECT_VIEW ? view : undefined,
    sort: order !== DEFAULT_PROJECT_SORT ? order : undefined,
  };
};

const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

export const compareText = (a: string, b: string) => {
  const left = a.trim();
  const right = b.trim();
  return Number(left === "") - Number(right === "") || collator.compare(left, right);
};

type SortableEntry = { project: { key: string; name: string }; favorite: boolean };

const COMPARATORS: Record<Exclude<ProjectSort, "standard">, (a: SortableEntry, b: SortableEntry) => number> = {
  name: (a, b) => compareText(a.project.name, b.project.name),
  schluessel: (a, b) => compareText(a.project.key, b.project.key),
  favoriten: (a, b) => Number(b.favorite) - Number(a.favorite) || compareText(a.project.name, b.project.name),
};

export const sortProjectEntries = <T extends SortableEntry>(entries: readonly T[], sort: ProjectSort): T[] =>
  sort === "standard" ? [...entries] : [...entries].sort(COMPARATORS[sort]);

type DirectoryProject = { id: string; key: string; name: string };

export type ProjectDirectoryEmpty = "none" | "no-favorites" | "no-matches" | null;

export const projectDirectory = <T extends DirectoryProject>(
  projects: readonly T[],
  {
    query,
    view,
    sort = DEFAULT_PROJECT_SORT,
    favoriteIds,
    hiddenIds,
  }: { query: string; view: ProjectView; sort?: ProjectSort; favoriteIds: readonly string[]; hiddenIds: readonly string[] },
) => {
  const needle = normalizeNeedle(query);
  const favorites = projects.filter((project) => favoriteIds.includes(project.id));
  const scoped = view === "favoriten" ? favorites : projects;
  const matches = scoped
    .filter((project) => matchesNeedle(needle, project.name, project.key))
    .map((project) => ({
      project,
      favorite: favoriteIds.includes(project.id),
      hidden: hiddenIds.includes(project.id),
    }));
  const entries = sortProjectEntries(matches, sort);
  const empty: ProjectDirectoryEmpty =
    entries.length > 0 ? null : projects.length === 0 ? "none" : scoped.length === 0 ? "no-favorites" : "no-matches";

  return {
    entries,
    empty,
    counts: { alle: projects.length, favoriten: favorites.length } satisfies Record<ProjectView, number>,
  };
};
