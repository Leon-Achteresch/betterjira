import { create } from "zustand";
import { persist } from "zustand/middleware";
import { commentIdOfNotification } from "@/lib/jira/notification-feed";
import type { JiraNotification } from "@/lib/jira/notifications";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { ACTIVITY_LOOKBACK_MS, MAX_NOTIFICATION_ITEMS, restoreInbox } from "@/lib/notifications/inbox-state";
import { workspaceId } from "@/lib/workspace";
import { isSnoozed, retainInboxItems, wakeSnoozed, type SnoozedIssues } from "@/lib/notifications/snooze";

type NotificationState = {
  owner: string | null;
  items: JiraNotification[];
  checkedAt: number | null;
  seen: Record<string, number>;
  snoozed: SnoozedIssues;
  adopt: (owner: string) => void;
  receive: (items: JiraNotification[], checkedAt: number) => JiraNotification[];
  setRead: (ids: string[], read: boolean) => void;
  markAllRead: () => void;
  setSnooze: (owner: string, key: string, until: number | null, expected?: number | null) => boolean;
  wakeDue: (now?: number) => void;
};

const NO_ITEMS: JiraNotification[] = [];
const NO_SNOOZES: SnoozedIssues = {};

export const useNotifications = create<NotificationState>()(
  persist(
    (set, get) => ({
      owner: null,
      items: [],
      checkedAt: null,
      seen: {},
      snoozed: {},
      adopt: (owner) => {
        const current = get().owner;
        if (current === owner) return;
        set({ owner, items: [], checkedAt: null, seen: {}, snoozed: {} });
      },
      receive: (incoming, checkedAt) => {
        const state = get();
        const watermark = Math.max(state.checkedAt ?? checkedAt, checkedAt);
        const seen = Object.fromEntries(Object.entries(state.seen).filter(([, time]) => time >= watermark - ACTIVITY_LOOKBACK_MS));
        const known = new Set([...Object.keys(seen), ...state.items.map((item) => item.id)]);
        const fresh = incoming.filter((item) => {
          if (known.has(item.id) || !Number.isFinite(item.created) || item.created < watermark - ACTIVITY_LOOKBACK_MS) return false;
          known.add(item.id);
          seen[item.id] = item.created;
          return true;
        });
        const activeKeys = new Set(fresh.map((item) => item.issueKey));
        const snoozed = Object.fromEntries(Object.entries(state.snoozed).filter(([key]) => !activeKeys.has(key)));
        const awakened = wakeSnoozed([...fresh, ...state.items], snoozed, checkedAt);
        set({
          checkedAt: watermark,
          seen,
          snoozed: awakened.snoozed,
          items: retainInboxItems(awakened.items, awakened.snoozed, MAX_NOTIFICATION_ITEMS),
        });
        return fresh;
      },
      setRead: (ids, read) => {
        const targets = new Set(ids);
        set(({ items }) => ({ items: items.map((item) => (targets.has(item.id) ? { ...item, read } : item)) }));
      },
      markAllRead: () => set(({ items, snoozed }) => ({ items: items.map((item) => isSnoozed(item.issueKey, snoozed) ? item : { ...item, read: true }) })),
      setSnooze: (owner, key, until, expected) => {
        const state = get();
        if (state.owner !== owner || !state.items.some((item) => item.issueKey === key)) return false;
        if (expected !== undefined && (state.snoozed[key] ?? null) !== expected) return false;
        if (until !== null && (!Number.isFinite(until) || until <= Date.now() || until > 8.64e15)) return false;
        const snoozed = { ...state.snoozed };
        if (until === null) delete snoozed[key];
        else snoozed[key] = until;
        set({ snoozed });
        return true;
      },
      wakeDue: (now = Date.now()) => {
        const state = get();
        const awakened = wakeSnoozed(state.items, state.snoozed, now);
        if (awakened.changed) set({ snoozed: awakened.snoozed, items: awakened.items });
      },
    }),
    {
      name: "betterjira-notifications",
      version: 4,
      migrate: (persisted) => restoreInbox(persisted),
      merge: (persisted, current) => ({ ...current, ...restoreInbox(persisted) }),
    },
  ),
);

export const useNotificationOwner = () => {
  const site = useJiraSite();
  const myself = useJiraMyself();
  return site.data && myself.data ? workspaceId(site.data.cloudId, myself.data.accountId) : null;
};

export const useOwnedSnoozes = () => {
  const owner = useNotificationOwner();
  return useNotifications((state) => owner !== null && state.owner === owner ? state.snoozed : NO_SNOOZES);
};

export const useOwnedNotifications = (includeSnoozed = false) => {
  const owner = useNotificationOwner();
  const snoozed = useOwnedSnoozes();
  const items = useNotifications((state) => (owner !== null && state.owner === owner ? state.items : NO_ITEMS));
  return includeSnoozed ? items : items.filter((item) => !isSnoozed(item.issueKey, snoozed));
};

export const useOwnedUnreadCount = () => useOwnedNotifications().filter((item) => !item.read).length;

export const useOwnedCheckedAt = () => {
  const owner = useNotificationOwner();
  return useNotifications((state) => (owner !== null && state.owner === owner ? state.checkedAt : null));
};

export const openNotification = (item: JiraNotification, openIssue: (key: string, commentId?: string) => void) => {
  const { items, setRead } = useNotifications.getState();
  setRead(items.filter((entry) => entry.issueKey === item.issueKey).map((entry) => entry.id), true);
  openIssue(item.issueKey, commentIdOfNotification(item.id));
};
