export type SearchMode = "einfach" | "jql";

export type SucheSearch = {
  modus?: SearchMode;
  jql?: string;
  projekt?: string;
  q?: string;
};

export const QUERY_MAX_LENGTH = 200;

const PROJECT_KEY = /^[A-Z][A-Z0-9_]*$/;

export const normalizeQuery = (value: string) => value.trim().slice(0, QUERY_MAX_LENGTH);

export const queryOf = (value: unknown) => {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? normalizeQuery(value) : "";
  return text || undefined;
};

const projectOf = (value: unknown) => {
  const key = typeof value === "string" ? value.trim().toUpperCase() : "";
  return PROJECT_KEY.test(key) ? key : undefined;
};

const jqlOf = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

const modeOf = (value: unknown): SearchMode | undefined => (value === "einfach" || value === "jql" ? value : undefined);

const compact = (search: SucheSearch): SucheSearch =>
  Object.fromEntries(Object.entries(search).filter(([, value]) => value !== undefined));

export const searchModeOf = ({ modus, jql }: SucheSearch): SearchMode => modus ?? (jql ? "jql" : "einfach");

export const withMode = ({ jql, projekt, q }: SucheSearch, mode: SearchMode): SucheSearch =>
  compact({ jql, projekt, q, modus: searchModeOf({ jql }) === mode ? undefined : mode });

export const parseSucheSearch = (raw: Record<string, unknown>): SucheSearch => {
  const search = { jql: jqlOf(raw.jql), projekt: projectOf(raw.projekt), q: queryOf(raw.q) };
  const mode = modeOf(raw.modus) ?? searchModeOf(search);
  return { ...search, modus: searchModeOf(search) === mode ? undefined : mode };
};
