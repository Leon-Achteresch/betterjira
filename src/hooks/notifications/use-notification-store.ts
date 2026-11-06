import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { JiraNotification } from "@/lib/jira/notifications";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { workspaceId } from "@/lib/workspace";

type NotificationState = {
  owner: string | null;
  items: JiraNotification[];
  checkedAt: number | null;
  adopt: (owner: string) => void;
  receive: (items: JiraNotification[], checkedAt: number) => JiraNotification[];
  setRead: (ids: string[], read: boolean) => void;
  markAllRead: () => void;
};

const MAX_ITEMS = 200;
const NO_ITEMS: JiraNotification[] = [];

export const useNotifications = create<NotificationState>()(
  persist(
    (set, get) => ({
      owner: null,
      items: [],
      checkedAt: null,
      adopt: (owner) => {
        const current = get().owner;
        if (current === owner) return;
        set(current === null ? { owner } : { owner, items: [], checkedAt: null });
      },
      receive: (incoming, checkedAt) => {
        const known = new Set(get().items.map((item) => item.id));
        const fresh = incoming.filter((item) => !known.has(item.id));
        set(({ items }) => ({
          checkedAt,
          items: [...fresh, ...items].sort((a, b) => b.created - a.created).slice(0, MAX_ITEMS),
        }));
        return fresh;
      },
      setRead: (ids, read) => {
        const targets = new Set(ids);
        set(({ items }) => ({ items: items.map((item) => (targets.has(item.id) ? { ...item, read } : item)) }));
      },
      markAllRead: () => set(({ items }) => ({ items: items.map((item) => ({ ...item, read: true })) })),
    }),
    {
      name: "betterjira-notifications",
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { items?: Array<Partial<JiraNotification>>; checkedAt?: number | null; owner?: string | null };
        return {
          owner: state.owner ?? null,
          checkedAt: state.checkedAt ?? null,
          items: (state.items ?? []).map((item) => ({ kind: "watching", ...item })),
        } as NotificationState;
      },
    },
  ),
);

export const useNotificationOwner = () => {
  const site = useJiraSite();
  const myself = useJiraMyself();
  return site.data && myself.data ? workspaceId(site.data.cloudId, myself.data.accountId) : null;
};

export const useOwnedNotifications = () => {
  const owner = useNotificationOwner();
  return useNotifications((state) => (owner !== null && state.owner === owner ? state.items : NO_ITEMS));
};

export const useOwnedUnreadCount = () => useOwnedNotifications().filter((item) => !item.read).length;

export const useOwnedCheckedAt = () => {
  const owner = useNotificationOwner();
  return useNotifications((state) => (owner !== null && state.owner === owner ? state.checkedAt : null));
};

export const openNotification = (item: JiraNotification, openIssue: (key: string) => void) => {
  const { items, setRead } = useNotifications.getState();
  setRead(items.filter((entry) => entry.issueKey === item.issueKey).map((entry) => entry.id), true);
  openIssue(item.issueKey);
};
