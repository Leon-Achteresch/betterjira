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
