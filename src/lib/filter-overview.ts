export const FILTER_OVERVIEW_VIEWS = [
  { id: "alle", label: "Alle" },
  { id: "favoriten", label: "Favoriten" },
] as const;

export type FilterOverviewView = (typeof FILTER_OVERVIEW_VIEWS)[number]["id"];

export type FilterOverviewSearch = { ansicht?: FilterOverviewView; q?: string };

type OverviewFilter = { id: string; name: string; favourite?: boolean; jql?: string };

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
    .filter((filter) => inView(filter, view) && (filter.name.toLocaleLowerCase("de").includes(needle) || (filter.jql ?? "").toLocaleLowerCase("de").includes(needle)))
    .sort(
      (a, b) =>
        Number(!!b.favourite) - Number(!!a.favourite) || a.name.localeCompare(b.name, "de", { sensitivity: "base" }),
    );
};

export const FILTER_CONTENT_PAGE_SIZE = 8;
const MATCH_CONTEXT = 44;

const availableJql = (filter: OverviewFilter) => filter.jql?.trim() ? filter.jql : undefined;

export const filterContentCoverage = (filters: readonly OverviewFilter[]) => ({
  loaded: filters.length,
  missing: filters.filter((filter) => !availableJql(filter)).length,
});

export function findFilterContent(filters: readonly OverviewFilter[], query: string) {
  const term = query.trim();
  if (!term) return [];
  const literal = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu");
  return visibleFilters(filters, "alle", "").flatMap((filter) => {
    const jql = availableJql(filter);
    if (!jql) return [];
    const match = literal.exec(jql);
    if (!match) return [];
    const index = match.index;
    const from = Math.max(0, index - MATCH_CONTEXT);
    const to = Math.min(jql.length, index + Math.min(match[0].length, 96) + MATCH_CONTEXT);
    return [{ id: filter.id, name: filter.name, snippet: `${from > 0 ? "…" : ""}${jql.slice(from, to)}${to < jql.length ? "…" : ""}` }];
  });
}

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
    ? { title: "Kein passender Filter", description: "Die Suche prüft Namen und geladene JQL deiner eigenen und favorisierten Filter." }
    : EMPTY_STATES[view];
