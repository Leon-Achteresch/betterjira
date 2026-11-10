export type NotificationKind = "direct" | "watching";

export type FeedItem = {
  id: string;
  issueKey: string;
  summary: string;
  created: number;
  read: boolean;
  kind: NotificationKind;
};

export type FeedGroup<T extends FeedItem> = {
  issueKey: string;
  summary: string;
  items: T[];
  latest: T;
  unread: number;
};

type ChangeItem = { field: string; fromString?: string | null; toString?: string | null; to?: string | null };

const FIELD_TITLES: Record<string, string> = {
  status: "hat den Status geändert",
  priority: "hat die Priorität geändert",
  resolution: "hat die Lösung geändert",
  summary: "hat die Zusammenfassung geändert",
  description: "hat die Beschreibung aktualisiert",
  Attachment: "hat einen Anhang hinzugefügt",
  labels: "hat die Labels geändert",
  Sprint: "hat den Sprint geändert",
  duedate: "hat das Fälligkeitsdatum geändert",
  "Fix Version": "hat die Lösungsversion geändert",
  Link: "hat eine Verknüpfung geändert",
};

const NOISE_FIELDS = new Set(["Rank", "RemoteIssueLink", "timespent", "timeestimate", "timeoriginalestimate", "WorklogId", "Workflow"]);

export const isNoiseChange = (items: ReadonlyArray<{ field: string }>) => items.every((item) => NOISE_FIELDS.has(item.field));

export const describeChanges = (items: ReadonlyArray<ChangeItem>, me: string) => {
  const assignee = items.find((item) => item.field === "assignee");
  if (assignee?.to === me) return { title: "hat dir ein Ticket zugewiesen", body: "", kind: "direct" as const };
  const status = items.find((item) => item.field === "status");
  if (status) return { title: FIELD_TITLES.status!, body: `${status.fromString ?? "–"} → ${status.toString ?? "–"}` };
  if (assignee) {
    return { title: "hat die Zuweisung geändert", body: assignee.toString ? `Zugewiesen an ${assignee.toString}` : "Zuweisung entfernt" };
  }
  const fields = [...new Set(items.map((item) => item.field))];
  if (fields.length === 1) {
    const [only] = items;
    const title = FIELD_TITLES[fields[0]!] ?? `hat ${fields[0]} geändert`;
    const body = only?.toString && fields[0] !== "description" ? only.toString : "";
    return { title, body };
  }
  return { title: `hat ${fields.length} Felder aktualisiert`, body: fields.join(", ") };
};

export const groupByIssue = <T extends FeedItem>(items: T[]): FeedGroup<T>[] => {
  const groups = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => b.created - a.created)) {
    groups.set(item.issueKey, [...(groups.get(item.issueKey) ?? []), item]);
  }
  return [...groups.entries()].map(([issueKey, grouped]) => ({
    issueKey,
    summary: grouped[0]!.summary,
    items: grouped,
    latest: grouped[0]!,
    unread: grouped.filter((item) => !item.read).length,
  }));
};

export const filterFeed = <T extends FeedItem>(items: T[], kind: NotificationKind, unreadOnly: boolean) =>
  items.filter((item) => item.kind === kind && (!unreadOnly || !item.read));

export type SearchableFeedItem = FeedItem & { title: string; body: string; actor: { displayName: string } };

const searchTerms = (query: string) => query.toLocaleLowerCase("de").split(/\s+/).filter(Boolean);

export const searchFeed = <T extends SearchableFeedItem>(items: T[], query: string) => {
  const terms = searchTerms(query);
  if (terms.length === 0) return items;
  return items.filter((item) => {
    const text = [item.issueKey, item.summary, item.title, item.body, item.actor.displayName].join(" ").toLocaleLowerCase("de");
    return terms.every((term) => text.includes(term));
  });
};

export const countUnread = <T extends FeedItem>(items: T[]): Record<NotificationKind, number> => ({
  direct: items.filter((item) => item.kind === "direct" && !item.read).length,
  watching: items.filter((item) => item.kind === "watching" && !item.read).length,
});

export type FeedSectionId = "today" | "yesterday" | "week" | "older";

export type FeedSection<T extends FeedItem> = { id: FeedSectionId; label: string; groups: FeedGroup<T>[] };

const SECTION_LABELS: Record<FeedSectionId, string> = {
  today: "Heute",
  yesterday: "Gestern",
  week: "Letzte 7 Tage",
  older: "Älter",
};

const DAY_MS = 24 * 60 * 60 * 1000;

const sectionOf = (created: number, now: number): FeedSectionId => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = today.getTime();
  if (created >= start) return "today";
  if (created >= start - DAY_MS) return "yesterday";
  if (created >= start - 6 * DAY_MS) return "week";
  return "older";
};

export const sectionByDay = <T extends FeedItem>(groups: FeedGroup<T>[], now: number): FeedSection<T>[] => {
  const sections = new Map<FeedSectionId, FeedGroup<T>[]>();
  for (const group of groups) {
    const id = sectionOf(group.latest.created, now);
    sections.set(id, [...(sections.get(id) ?? []), group]);
  }
  return (Object.keys(SECTION_LABELS) as FeedSectionId[])
    .filter((id) => sections.has(id))
    .map((id) => ({ id, label: SECTION_LABELS[id], groups: sections.get(id)! }));
};

export type InboxSearch = { ansicht?: "beobachtet"; nur?: "ungelesen"; suche?: string };

export const inboxSearchOf = (search: Record<string, unknown>): InboxSearch => ({
  ...(search.ansicht === "beobachtet" && { ansicht: "beobachtet" as const }),
  ...(search.nur === "ungelesen" && { nur: "ungelesen" as const }),
  ...(typeof search.suche === "string" && search.suche.trim() && { suche: search.suche }),
});

export const inboxKindOf = (search: InboxSearch): NotificationKind => (search.ansicht === "beobachtet" ? "watching" : "direct");

export const KIND_LABELS: Record<NotificationKind, string> = { direct: "Direkt", watching: "Beobachtet" };

export const commentIdOfNotification = (id: string) => /^c:(\d+)$/.exec(id)?.[1];
