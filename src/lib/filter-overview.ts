export const FILTER_OVERVIEW_VIEWS = [
  { id: "alle", label: "Alle" },
  { id: "favoriten", label: "Favoriten" },
] as const;

export type FilterOverviewView = (typeof FILTER_OVERVIEW_VIEWS)[number]["id"];

export type FilterOverviewSearch = { ansicht?: FilterOverviewView; q?: string };

type OverviewFilter = { id: string; name: string; favourite?: boolean };

export const filterOverviewViewOf = (value: unknown): FilterOverviewView =>
  FILTER_OVERVIEW_VIEWS.find((view) => view.id === value)?.id ?? "alle";

export const filterOverviewSearch = (view: FilterOverviewView, query = ""): FilterOverviewSearch => ({
  ...(view !== "alle" && { ansicht: view }),
  ...(query && { q: query }),
});

export const parseFilterOverviewSearch = (search: Record<string, unknown>): FilterOverviewSearch => {
  const parsed = filterOverviewSearch(filterOverviewViewOf(search.ansicht), typeof search.q === "string" ? search.q : "");
  return { ansicht: parsed.ansicht, q: parsed.q };
};

const inView = (filter: OverviewFilter, view: FilterOverviewView) => view === "alle" || !!filter.favourite;

export const filterOverviewCounts = (filters: readonly OverviewFilter[]): Record<FilterOverviewView, number> => ({
  alle: filters.length,
  favoriten: filters.filter((filter) => filter.favourite).length,
});

export const visibleFilters = <T extends OverviewFilter>(filters: readonly T[], view: FilterOverviewView, query: string) => {
  const needle = query.trim().toLocaleLowerCase("de");
  return filters
    .filter((filter) => inView(filter, view) && filter.name.toLocaleLowerCase("de").includes(needle))
    .sort(
      (a, b) =>
        Number(!!b.favourite) - Number(!!a.favourite) || a.name.localeCompare(b.name, "de", { sensitivity: "base" }),
    );
};

export type FilterOverviewStatus = "pending" | "error" | "ready";

export const filterOverviewStatus = ({ hasData, isError }: { hasData: boolean; isError: boolean }): FilterOverviewStatus =>
  hasData ? "ready" : isError ? "error" : "pending";

export const withFavourite = <T extends OverviewFilter>(filters: readonly T[], id: string, favourite: boolean): T[] =>
  filters.map((filter) => (filter.id === id ? { ...filter, favourite } : filter));

const EMPTY_STATES: Record<FilterOverviewView, { title: string; description: string }> = {
  alle: {
    title: "Noch keine Filter",
    description: "Speichere eine JQL-Suche als Filter. Eigene und in Jira favorisierte Filter erscheinen hier.",
  },
  favoriten: {
    title: "Keine Favoriten",
    description: "Markiere Filter mit dem Stern, damit sie hier und oben in der Seitenleiste stehen.",
  },
};

export const filterOverviewEmptyState = (view: FilterOverviewView, query: string) =>
  query.trim()
    ? { title: "Kein passender Filter", description: "Die Suche prüft die Namen deiner eigenen und favorisierten Filter." }
    : EMPTY_STATES[view];
