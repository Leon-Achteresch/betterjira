import { Data, Effect, Option, Schema } from "effect";
import { jira, JiraApiError, JiraAuthError, type JiraRequestScope } from "./client";
import { jiraKeys } from "./queries";
import { historyTimestamp, type StatusTransition } from "./status-intervals";

export const HISTORY_PAGE_SIZE = 20;
export const HISTORY_LIMIT = 200;
const TEXT_LIMIT = 2000;
const LONG_TEXT = 160;
const LONG_LINES = 3;

const ChangelogPage = Schema.Struct({
  startAt: Schema.Number,
  total: Schema.Number,
  values: Schema.Array(Schema.Unknown),
});

const Changelog = Schema.Struct({
  id: Schema.String,
  created: Schema.optional(Schema.NullOr(Schema.String)),
  author: Schema.optional(Schema.NullOr(Schema.Unknown)),
  items: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),
});

const Author = Schema.Struct({
  displayName: Schema.String,
  avatarUrls: Schema.optional(Schema.NullOr(Schema.Struct({ "48x48": Schema.optional(Schema.String) }))),
});

const ChangeItem = Schema.Struct({
  field: Schema.optional(Schema.NullOr(Schema.String)),
  fieldId: Schema.optional(Schema.NullOr(Schema.String)),
  from: Schema.optional(Schema.NullOr(Schema.Unknown)),
  fromString: Schema.optional(Schema.NullOr(Schema.Unknown)),
  to: Schema.optional(Schema.NullOr(Schema.Unknown)),
  toString: Schema.optional(Schema.NullOr(Schema.Unknown)),
});

export type HistoryValue = { kind: "empty" } | { kind: "opaque" } | { kind: "text"; text: string; long: boolean };

export type HistoryChange = { field: string; from: HistoryValue; to: HistoryValue };

export type HistoryAuthor = { displayName: string; avatarUrl?: string };

export type HistoryEntry = {
  id: string;
  created?: string;
  author?: HistoryAuthor;
  changes: HistoryChange[];
  statusTransitions?: StatusTransition[];
  unreadable?: boolean;
};

export type HistoryPage = { startAt: number; total: number; entries: HistoryEntry[]; received?: number };

export type HistoryPageParam = { startAt: number; maxResults: number } | null;

export type IssueHistory = { entries: HistoryEntry[]; total: number; covered: number; coverage?: { complete: boolean; contiguous: boolean } };

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  assignee: "Bearbeiter",
  reporter: "Melder",
  priority: "Priorität",
  resolution: "Lösung",
  summary: "Zusammenfassung",
  description: "Beschreibung",
  environment: "Umgebung",
  labels: "Labels",
  duedate: "Fälligkeitsdatum",
  issuetype: "Vorgangstyp",
  project: "Projekt",
  Key: "Schlüssel",
  Sprint: "Sprint",
  "Fix Version": "Lösungsversion",
  fixVersions: "Lösungsversion",
  Version: "Betroffene Version",
  versions: "Betroffene Version",
  Component: "Komponente",
  components: "Komponente",
  Attachment: "Anhang",
  Link: "Verknüpfung",
  RemoteIssueLink: "Externer Link",
  Parent: "Übergeordnet",
  IssueParentAssociation: "Übergeordnet",
  "Epic Link": "Epic",
  Rank: "Rang",
  WorklogId: "Arbeitsprotokoll",
  timeestimate: "Restschätzung",
  timeoriginalestimate: "Ursprüngliche Schätzung",
  timespent: "Erfasste Zeit",
  Workflow: "Workflow",
};

const DURATION_FIELDS = new Set(["timeestimate", "timeoriginalestimate", "timespent"]);
const OPAQUE_FIELDS = new Set(["WorklogId"]);
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩]/g;
const RAW_ID = /^customfield_\d+$/;

export const readableText = (raw: unknown) =>
  typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").replace(CONTROL_CHARACTERS, "").trim() : "";

const formatSeconds = (text: string) => {
  if (!/^\d+$/.test(text)) return text;
  const minutes = Math.round(Number(text) / 60);
  const hours = Math.floor(minutes / 60);
  const parts = [hours > 0 && `${hours}h`, minutes % 60 > 0 && `${minutes % 60}m`].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "0m";
};

const isPresent = (raw: unknown) => raw !== null && raw !== undefined && raw !== "";

const valueOf = (field: string, text: unknown, id: unknown): HistoryValue => {
  const clean = readableText(text);
  if (!clean) return isPresent(id) || isPresent(text) ? { kind: "opaque" } : { kind: "empty" };
  if (OPAQUE_FIELDS.has(field)) return { kind: "opaque" };
  const shown = DURATION_FIELDS.has(field) ? formatSeconds(clean) : clean;
  const clipped = shown.length > TEXT_LIMIT ? `${shown.slice(0, TEXT_LIMIT).trimEnd()} …` : shown;
  return { kind: "text", text: clipped, long: clipped.length > LONG_TEXT || clipped.split("\n").length > LONG_LINES };
};

export const fieldLabel = (field?: string | null, fieldId?: string | null) => {
  const name = readableText(field);
  const id = readableText(fieldId);
  return FIELD_LABELS[name] ?? FIELD_LABELS[id] ?? (name && !RAW_ID.test(name) ? name : "Unbekanntes Feld");
};

const decodeChangelog = Schema.decodeUnknownOption(Changelog);
const decodeItem = Schema.decodeUnknownOption(ChangeItem);
const isAuthor = Schema.is(Author);

const authorOf = (raw: unknown): HistoryAuthor | undefined => {
  if (!isAuthor(raw)) return undefined;
  const displayName = readableText(raw.displayName);
  if (!displayName) return undefined;
  const avatarUrl = raw.avatarUrls?.["48x48"];
  return avatarUrl ? { displayName, avatarUrl } : { displayName };
};

const changeOf = (raw: unknown): HistoryChange[] => {
  const item = Option.getOrUndefined(decodeItem(raw));
  if (!item) return [];
  const key = readableText(item.field) || readableText(item.fieldId);
  return [{ field: fieldLabel(item.field, item.fieldId), from: valueOf(key, item.fromString, item.from), to: valueOf(key, item.toString, item.to) }];
};

export const toHistoryEntry = (raw: unknown): HistoryEntry | undefined => {
  const changelog = Option.getOrUndefined(decodeChangelog(raw));
  const id = readableText(changelog?.id);
  if (!changelog || !id) return undefined;
  const created = changelog.created && historyTimestamp(changelog.created) !== undefined ? changelog.created : undefined;
  const author = authorOf(changelog.author);
  const items = (changelog.items ?? []).map((item) => Option.getOrUndefined(decodeItem(item)));
  const statusTransitions = items.flatMap((item) => {
    if (!item || (item.fieldId ? item.fieldId !== "status" : item.field?.toLowerCase() !== "status")) return [];
    const identity = (id: unknown, name: unknown) => ({
      ...(typeof id === "string" && id.trim() ? { id: id.trim() } : Number.isSafeInteger(id) ? { id: String(id) } : {}),
      ...(readableText(name) ? { name: readableText(name) } : {}),
    });
    return [{ from: identity(item.from, item.fromString), to: identity(item.to, item.toString) }];
  });
  return {
    id,
    ...(created && { created }),
    ...(author && { author }),
    changes: (changelog.items ?? []).flatMap(changeOf),
    ...(statusTransitions.length && { statusTransitions }),
    ...((!changelog.items || items.some((item) => !item || (!item.field && !item.fieldId))) && { unreadable: true }),
  };
};

const timeOf = (entry: HistoryEntry) => (entry.created ? Date.parse(entry.created) : Number.NEGATIVE_INFINITY);

const newestFirst = (a: HistoryEntry, b: HistoryEntry) =>
  timeOf(b) - timeOf(a) || b.id.localeCompare(a.id, undefined, { numeric: true });

export const mergeHistoryPages = (pages: readonly HistoryPage[]): IssueHistory => {
  const byId = new Map<string, HistoryEntry>();
  for (const page of pages) for (const entry of page.entries) if (!byId.has(entry.id)) byId.set(entry.id, entry);
  const latest = pages[0];
  const total = latest?.total ?? 0;
  const ordered = [...pages].sort((a, b) => a.startAt - b.startAt);
  const oldest = ordered[0];
  let cursor = ordered[0]?.startAt ?? 0;
  let contiguous = pages.length > 0;
  for (const page of ordered) {
    if (page.total !== total || page.startAt > cursor || page.entries.length !== (page.received ?? page.entries.length) || page.entries.some((entry) => entry.unreadable)) contiguous = false;
    for (const entry of page.entries) {
      const chosen = byId.get(entry.id);
      if (chosen && JSON.stringify([chosen.created, chosen.statusTransitions]) !== JSON.stringify([entry.created, entry.statusTransitions])) contiguous = false;
    }
    cursor = Math.max(cursor, page.startAt + (page.received ?? page.entries.length));
  }
  if (cursor !== total || byId.size !== cursor - (ordered[0]?.startAt ?? 0)) contiguous = false;
  return {
    entries: [...byId.values()].sort(newestFirst),
    total,
    covered: oldest ? Math.min(total, Math.max(0, total - oldest.startAt)) : 0,
    ...(pages.some((page) => page.received !== undefined) && { coverage: { contiguous, complete: contiguous && ordered[0]?.startAt === 0 } }),
  };
};

export const latestPageParam = (total: number) => ({ startAt: Math.max(0, total - HISTORY_PAGE_SIZE), maxResults: HISTORY_PAGE_SIZE });

export const olderPageParam = (pages: readonly HistoryPage[]): HistoryPageParam | undefined => {
  const oldest = pages.at(-1);
  if (!oldest || oldest.startAt <= 0) return undefined;
  if (mergeHistoryPages(pages).covered >= HISTORY_LIMIT) return undefined;
  const startAt = Math.max(0, oldest.startAt - HISTORY_PAGE_SIZE);
  return { startAt, maxResults: oldest.startAt - startAt };
};

export const issueHistoryKeys = {
  issue: (cloudId: string, accountId: string, key: string) => [...jiraKeys.issue(key), "history", cloudId, accountId] as const,
};

const changelogPath = (key: string, { startAt, maxResults }: { startAt: number; maxResults: number }) =>
  `/issue/${encodeURIComponent(key)}/changelog?${new URLSearchParams({ startAt: String(startAt), maxResults: String(maxResults) })}`;

const toPage = (page: typeof ChangelogPage.Type): HistoryPage => ({
  startAt: page.startAt,
  total: page.total,
  entries: page.values.flatMap((value) => toHistoryEntry(value) ?? []),
  received: page.values.length,
});

export class HistoryPagingError extends Data.TaggedError("HistoryPagingError")<{}> {
  readonly message = "Jira hat nicht alle angefragten Änderungen geliefert. Bitte erneut versuchen.";
}

const readWindow = (
  key: string,
  param: NonNullable<HistoryPageParam>,
  total: number,
  seed?: typeof ChangelogPage.Type,
  scope?: JiraRequestScope,
) =>
  Effect.gen(function* () {
    const end = Math.min(total, param.startAt + Math.min(HISTORY_PAGE_SIZE, param.maxResults));
    const values: unknown[] = [];
    let cursor = param.startAt;
    let next = seed;
    while (cursor < end) {
      const page = next ?? (yield* jira(changelogPath(key, { startAt: cursor, maxResults: end - cursor }), ChangelogPage, { scope }));
      next = undefined;
      if (page.total !== total || page.startAt !== cursor || page.values.length === 0) return yield* Effect.fail(new HistoryPagingError());
      const chunk = page.values.slice(0, end - cursor);
      values.push(...chunk);
      cursor += chunk.length;
    }
    return toPage({ startAt: param.startAt, total, values });
  });

export const fetchIssueHistory = (key: string, param: HistoryPageParam, scope?: JiraRequestScope) =>
  Effect.gen(function* () {
    const first = yield* jira(changelogPath(key, param ?? { startAt: 0, maxResults: HISTORY_PAGE_SIZE }), ChangelogPage, { scope });
    if (!Number.isSafeInteger(first.total) || first.total < 0 || !Number.isSafeInteger(first.startAt) || first.startAt < 0)
      return yield* Effect.fail(new HistoryPagingError());
    if (param) return yield* readWindow(key, param, first.total, first, scope);
    if (first.total <= HISTORY_PAGE_SIZE)
      return yield* readWindow(key, { startAt: 0, maxResults: HISTORY_PAGE_SIZE }, first.total, first, scope);
    const latest = latestPageParam(first.total);
    if (first.startAt <= latest.startAt && first.startAt + first.values.length >= first.total)
      return toPage({
        startAt: latest.startAt,
        total: first.total,
        values: first.values.slice(latest.startAt - first.startAt, first.total - first.startAt),
      });
    return yield* readWindow(key, latest, first.total, undefined, scope);
  });

const ApiErrorBody = Schema.Struct({ errorMessages: Schema.optional(Schema.Array(Schema.String)) });
const decodeApiErrorBody = Schema.decodeUnknownOption(ApiErrorBody);

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const historyErrorDetail = (error: unknown) => {
  if (error instanceof HistoryPagingError) return error.message;
  if (error instanceof JiraApiError) {
    if (error.status === 404) return "Das Ticket wurde nicht gefunden oder du darfst seinen Verlauf nicht sehen.";
    const body = Option.getOrUndefined(decodeApiErrorBody(parseJson(error.body)));
    const messages = (body?.errorMessages ?? []).map(readableText).filter(Boolean);
    return messages.length > 0 ? messages.join(" ").slice(0, 300) : `Jira antwortet mit Status ${error.status}.`;
  }
  if (error instanceof JiraAuthError) return error.message;
  return "Jira hat eine unerwartete Antwort geliefert.";
};
