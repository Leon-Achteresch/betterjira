import type { FeedItem } from "@/lib/jira/notification-feed";

export type SnoozedIssues = Readonly<Record<string, number>>;
export type SnoozePreset = "later" | "tomorrow" | "next-week";

export const snoozeUntil = (preset: SnoozePreset, now: number): number => {
  const date = new Date(now);
  if (preset === "later") return now + 3 * 60 * 60_000;
  date.setDate(date.getDate() + (preset === "tomorrow" ? 1 : 7));
  date.setHours(9, 0, 0, 0);
  return date.getTime();
};

export const isSnoozed = (key: string, snoozed: SnoozedIssues) => snoozed[key] !== undefined;

export const retainInboxItems = <T extends FeedItem>(items: readonly T[], snoozed: SnoozedIssues, limit: number): T[] => {
  let active = 0;
  return [...items].sort((a, b) => b.created - a.created).filter((item) => isSnoozed(item.issueKey, snoozed) || active++ < limit);
};

export const validSnoozes = (raw: unknown, keys: ReadonlySet<string>): SnoozedIssues =>
  Object.fromEntries(Object.entries(typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw : {}).filter((entry): entry is [string, number] =>
    keys.has(entry[0]) && typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] > 0 && entry[1] <= 8.64e15,
  ));

export const wakeSnoozed = <T extends FeedItem>(items: readonly T[], snoozed: SnoozedIssues, now: number) => {
  const due = new Set(Object.entries(snoozed).filter(([, until]) => until <= now).map(([key]) => key));
  return {
    snoozed: Object.fromEntries(Object.entries(snoozed).filter(([key]) => !due.has(key))),
    items: items.map((item) => due.has(item.issueKey) ? { ...item, read: false } : item),
    changed: due.size > 0,
  };
};
