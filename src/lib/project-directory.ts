import { matchesNeedle, normalizeNeedle } from "@/lib/sidebar-search";

export const PROJECT_VIEWS = {
  alle: { label: "Alle" },
  favoriten: { label: "Favoriten" },
} as const;

export type ProjectView = keyof typeof PROJECT_VIEWS;

export const PROJECT_VIEW_IDS = Object.keys(PROJECT_VIEWS) as ProjectView[];

const DEFAULT_PROJECT_VIEW: ProjectView = "alle";

const MAX_QUERY_LENGTH = 200;

export type ProjectDirectorySearch = { q?: string; ansicht?: ProjectView };

export const projectViewOf = (value: unknown): ProjectView =>
  PROJECT_VIEW_IDS.find((id) => id === value) ?? DEFAULT_PROJECT_VIEW;

export const projectDirectorySearch = ({ q, ansicht }: { q?: unknown; ansicht?: unknown }): ProjectDirectorySearch => {
  const view = projectViewOf(ansicht);
  const query = typeof q === "string" ? q.slice(0, MAX_QUERY_LENGTH) : "";
  return {
    q: query.trim() !== "" ? query : undefined,
    ansicht: view !== DEFAULT_PROJECT_VIEW ? view : undefined,
  };
};

type DirectoryProject = { id: string; key: string; name: string };

export type ProjectDirectoryEmpty = "none" | "no-favorites" | "no-matches" | null;

export const projectDirectory = <T extends DirectoryProject>(
  projects: readonly T[],
  {
    query,
    view,
    favoriteIds,
    hiddenIds,
  }: { query: string; view: ProjectView; favoriteIds: readonly string[]; hiddenIds: readonly string[] },
) => {
  const needle = normalizeNeedle(query);
  const favorites = projects.filter((project) => favoriteIds.includes(project.id));
  const scoped = view === "favoriten" ? favorites : projects;
  const entries = scoped
    .filter((project) => matchesNeedle(needle, project.name, project.key))
    .map((project) => ({
      project,
      favorite: favoriteIds.includes(project.id),
      hidden: hiddenIds.includes(project.id),
    }));
  const empty: ProjectDirectoryEmpty =
    entries.length > 0 ? null : projects.length === 0 ? "none" : scoped.length === 0 ? "no-favorites" : "no-matches";

  return {
    entries,
    empty,
    counts: { alle: projects.length, favoriten: favorites.length } satisfies Record<ProjectView, number>,
  };
};
