import { fieldText } from "./field-text";
import { EMPTY_VALUE, type JqlSort } from "./jql";
import type { JiraFieldInfo } from "./search";

export const KEY_COLUMN = "key";

export const DEFAULT_COLUMNS = [KEY_COLUMN, "issuetype", "summary", "status", "assignee", "priority", "updated"];

export const QUICK_FILTERS = {
  mine: { label: "Mir zugewiesen", jql: "assignee = currentUser()" },
  unassigned: { label: "Nicht zugewiesen", jql: "assignee is EMPTY" },
  open: { label: "Offen", jql: "statusCategory != Done" },
  recent: { label: "Letzte 7 Tage", jql: "updated >= -7d" },
  overdue: { label: "Überfällig", jql: "duedate < startOfDay() AND statusCategory != Done" },
  reported: { label: "Von mir erstellt", jql: "reporter = currentUser()" },
  watching: { label: "Beobachtet", jql: "watcher = currentUser()" },
} as const;

export type QuickFilter = keyof typeof QUICK_FILTERS;

export const FACETS = {
  status: "Status",
  issuetype: "Typ",
  priority: "Priorität",
  assignee: "Bearbeiter",
  labels: "Label",
} as const;

export type Facet = keyof typeof FACETS;
export type FacetSelection = Partial<Record<Facet, string[]>>;

export type IssueView = {
  columns: string[];
  sort: JqlSort[];
  quick: QuickFilter[];
  facets: FacetSelection;
  dense: boolean;
};

export const DEFAULT_VIEW: IssueView = { columns: DEFAULT_COLUMNS, sort: [], quick: [], facets: {}, dense: false };

export const toggleValue = <T>(values: readonly T[], value: T) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

export const moveValue = <T>(values: readonly T[], value: T, offset: number) => {
  const from = values.indexOf(value);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= values.length) return [...values];
  const next = [...values];
  next.splice(from, 1);
  next.splice(to, 0, value);
  return next;
};

export const sortClauseOf = (column: string, field?: JiraFieldInfo) => {
  if (column === KEY_COLUMN) return "key";
  if (!field?.orderable) return undefined;
  const names = field.clauseNames ?? [];
  return names.find((name) => name.startsWith("cf[")) ?? names[0] ?? field.id;
};

export const columnLabel = (column: string, field?: JiraFieldInfo) => (column === KEY_COLUMN ? "Schlüssel" : (field?.name ?? column));

export const pickableFields = (fields: readonly JiraFieldInfo[]) =>
  fields
    .filter((field) => field.navigable !== false && field.id !== "issuekey" && field.id !== "thumbnail")
    .sort((a, b) => Number(!!a.custom) - Number(!!b.custom) || a.name.localeCompare(b.name, "de"));

export type FacetOption = { value: string; label: string; iconUrl?: string; avatarUrl?: string };

const record = (value: unknown) => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined);
const text = (value: unknown) => (typeof value === "string" ? value : undefined);

const EMPTY_OPTION: FacetOption = { value: EMPTY_VALUE, label: "Leer" };

export const facetOptionsOf = (facet: Facet, fields: Record<string, unknown>): FacetOption[] => {
  const value = fields[facet];
  if (facet === "labels") {
    const labels = Array.isArray(value) ? value.filter((label): label is string => typeof label === "string") : [];
    return labels.length > 0 ? labels.map((label) => ({ value: label, label })) : [EMPTY_OPTION];
  }
  const item = record(value);
  if (!item) return [facet === "assignee" ? { ...EMPTY_OPTION, label: "Nicht zugewiesen" } : EMPTY_OPTION];
  if (facet === "assignee") {
    const accountId = text(item.accountId);
    if (!accountId) return [];
    return [{ value: accountId, label: fieldText(item), avatarUrl: text(record(item.avatarUrls)?.["48x48"]) }];
  }
  const name = text(item.name);
  return name ? [{ value: name, label: name, iconUrl: text(item.iconUrl) }] : [];
};

export const collectFacetOptions = (facet: Facet, issues: readonly { fields: Record<string, unknown> }[], selected: readonly string[] = []) => {
  const options = new Map<string, FacetOption>();
  for (const issue of issues) for (const option of facetOptionsOf(facet, issue.fields)) if (!options.has(option.value)) options.set(option.value, option);
  for (const value of selected) if (!options.has(value)) options.set(value, value === EMPTY_VALUE ? EMPTY_OPTION : { value, label: value });
  return [...options.values()].sort(
    (a, b) => Number(a.value === EMPTY_VALUE) - Number(b.value === EMPTY_VALUE) || a.label.localeCompare(b.label, "de"),
  );
};

export const facetCount = (facets: FacetSelection) => Object.values(facets).reduce((sum, values) => sum + (values?.length ?? 0), 0);
