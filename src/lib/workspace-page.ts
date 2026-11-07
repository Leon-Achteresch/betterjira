import { workQueueItems, type WorkQueueItem, type Workspace } from "@/lib/workspace";

export const WORKSPACE_PAGE_FILTERS = [
  { id: "alle", label: "Alle" },
  { id: "angeheftet", label: "Angeheftet" },
  { id: "entwuerfe", label: "Entwürfe" },
  { id: "notizen", label: "Notizen" },
  { id: "zuletzt", label: "Zuletzt" },
] as const;

export type WorkspacePageFilter = (typeof WORKSPACE_PAGE_FILTERS)[number]["id"];

export type WorkspacePageSearch = { art?: WorkspacePageFilter; q?: string };

export const workspacePageFilterOf = (value: unknown): WorkspacePageFilter =>
  WORKSPACE_PAGE_FILTERS.find((filter) => filter.id === value)?.id ?? "alle";

export const workspacePageSearch = (filter: WorkspacePageFilter, query = ""): WorkspacePageSearch => ({
  ...(filter !== "alle" && { art: filter }),
  ...(query && { q: query }),
});

export const parseWorkspacePageSearch = (search: Record<string, unknown>): WorkspacePageSearch =>
  workspacePageSearch(workspacePageFilterOf(search.art), typeof search.q === "string" ? search.q : "");

export type WorkspaceEntry = WorkQueueItem & {
  draft: string;
  recent: boolean;
  known: boolean;
};

export const workspaceEntries = (workspace: Workspace, fieldDraftKeys: readonly string[]): WorkspaceEntry[] => {
  const recentKeys = new Set(workspace.recent.map((issue) => issue.key));
  return workQueueItems(workspace, "recent", "", fieldDraftKeys).map((item) => ({
    ...item,
    draft: workspace.drafts[item.key]?.trim() ?? "",
    recent: recentKeys.has(item.key),
    known: item.summary !== item.key,
  }));
};

const matchesFilter = (entry: WorkspaceEntry, filter: WorkspacePageFilter) =>
  ({
    alle: true,
    angeheftet: entry.pinned,
    entwuerfe: entry.hasDraft || entry.hasFieldDraft,
    notizen: !!entry.note.trim(),
    zuletzt: entry.recent,
  })[filter];

const matchesQuery = (entry: WorkspaceEntry, normalized: string) =>
  !normalized ||
  `${entry.key} ${entry.summary} ${entry.note} ${entry.draft}`.toLocaleLowerCase("de").includes(normalized);

export const workspaceFilterCounts = (entries: readonly WorkspaceEntry[]): Record<WorkspacePageFilter, number> => {
  const count = (filter: WorkspacePageFilter) => entries.filter((entry) => matchesFilter(entry, filter)).length;
  return {
    alle: count("alle"),
    angeheftet: count("angeheftet"),
    entwuerfe: count("entwuerfe"),
    notizen: count("notizen"),
    zuletzt: count("zuletzt"),
  };
};

export const filterWorkspaceEntries = (
  entries: readonly WorkspaceEntry[],
  filter: WorkspacePageFilter,
  query: string,
) => {
  const normalized = query.trim().toLocaleLowerCase("de");
  return entries.filter((entry) => matchesFilter(entry, filter) && matchesQuery(entry, normalized));
};

const EMPTY_STATES: Record<WorkspacePageFilter, { title: string; description: string }> = {
  alle: {
    title: "Noch kein Arbeitskontext",
    description: "Öffne ein Ticket. Lesestelle, Entwürfe und Notizen erscheinen danach hier.",
  },
  angeheftet: {
    title: "Nichts angeheftet",
    description: "Hefte Tickets mit der Stecknadel an, die du nicht aus dem Blick verlieren willst.",
  },
  entwuerfe: {
    title: "Keine offenen Entwürfe",
    description: "Nicht abgeschickte Kommentare und Feldänderungen erscheinen hier.",
  },
  notizen: {
    title: "Keine privaten Notizen",
    description: "Notizen schreibst du im Ticket oder über „Notiz hinzufügen“ an einem Eintrag. Sie bleiben auf diesem Gerät.",
  },
  zuletzt: {
    title: "Noch nichts geöffnet",
    description: "Zuletzt geöffnete Tickets erscheinen hier mit ihrer Lesestelle.",
  },
};

export const workspaceEmptyState = (filter: WorkspacePageFilter, query: string) =>
  query.trim()
    ? { title: "Kein passender Arbeitskontext", description: "Suche nach Schlüssel, Titel, Notiz oder Entwurfstext." }
    : EMPTY_STATES[filter];
