import { useNavigate, useSearch } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import {
  KIND_LABELS,
  countUnread,
  filterFeed,
  groupByIssue,
  inboxKindOf,
  searchFeed,
  sectionByDay,
  type FeedGroup,
  type InboxSearch,
  type NotificationKind,
} from "@/lib/jira/notification-feed";
import { issueSearch } from "@/lib/jira/issue-link";
import type { JiraNotification } from "@/lib/jira/notifications";
import { useJiraSite } from "@/lib/jira/queries";
import { openNotification, useNotificationOwner, useNotifications, useOwnedCheckedAt, useOwnedNotifications, useOwnedSnoozes } from "./use-notification-store";
import { useNotificationSync } from "./use-notification-sync";
import { isSnoozed } from "@/lib/notifications/snooze";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const useNotificationInbox = () => {
  const search: InboxSearch = useSearch({ from: "/benachrichtigungen" });
  const navigate = useNavigate({ from: "/benachrichtigungen" });
  const siteUrl = useJiraSite().data?.siteUrl;
  const items = useOwnedNotifications(true);
  const owner = useNotificationOwner();
  const snoozed = useOwnedSnoozes();
  const setSnooze = useNotifications((state) => state.setSnooze);
  const checkedAt = useOwnedCheckedAt();
  const setRead = useNotifications((state) => state.setRead);
  const sync = useNotificationSync();

  const kind = inboxKindOf(search);
  const unreadOnly = search.nur === "ungelesen";
  const query = search.suche ?? "";
  const showSnoozed = search.ablage === "spaeter";
  const activeItems = items.filter((item) => isSnoozed(item.issueKey, snoozed) === showSnoozed);
  const matching = searchFeed(activeItems, query);
  const scoped = filterFeed(matching, kind, false);
  const scopeUnreadIds = scoped.filter((item) => !item.read).map((item) => item.id);
  const visible = unreadOnly ? scoped.filter((item) => !item.read) : scoped;
  const scopeName = query ? `Treffer in „${KIND_LABELS[kind]}“` : `„${KIND_LABELS[kind]}“`;

  const update = (next: InboxSearch, replace = false) => void navigate({ search: (previous: InboxSearch) => ({ ...previous, ...next }), replace });

  const markScopeRead = () => {
    const ids = scopeUnreadIds;
    if (ids.length === 0) return;
    setRead(ids, true);
    toast(`${plural(ids.length, "Benachrichtigung", "Benachrichtigungen")} in ${scopeName} gelesen`, {
      action: { label: "Rückgängig", onClick: () => setRead(ids, false) },
    });
  };

  const snoozeGroup = (group: FeedGroup<JiraNotification>, until: number) => {
    if (!owner) return;
    const previous = snoozed[group.issueKey] ?? null;
    if (!setSnooze(owner, group.issueKey, until)) {
      toast.error("Wähle einen Zeitpunkt in der Zukunft.");
      return;
    }
    if (!showSnoozed) requestAnimationFrame(() => document.getElementById("notification-inbox-location")?.focus());
    toast(`${group.issueKey} zurückgestellt`, {
      description: `Bis ${new Date(until).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}`,
      action: { label: "Rückgängig", onClick: () => setSnooze(owner, group.issueKey, previous, until) },
    });
  };

  const resumeGroup = (group: FeedGroup<JiraNotification>) => {
    if (!owner) return;
    const previous = snoozed[group.issueKey];
    if (previous === undefined || !setSnooze(owner, group.issueKey, null, previous)) return;
    setRead(group.items.map((item) => item.id), false);
    requestAnimationFrame(() => document.getElementById("notification-inbox-location")?.focus());
    toast(`${group.issueKey} wieder im Eingang`);
  };

  return {
    kind,
    unreadOnly,
    query,
    snoozed,
    showSnoozed,
    snoozedCount: Object.keys(snoozed).length,
    setShowSnoozed: (next: boolean) => update({ ablage: next ? "spaeter" : undefined }),
    snoozeGroup,
    resumeGroup,
    hasItems: items.length > 0,
    checkedAt,
    sync,
    unreadByKind: countUnread(matching),
    sections: sectionByDay(groupByIssue(visible), Date.now()),
    scopeUnread: scopeUnreadIds.length,
    markScopeReadLabel: `${scopeUnreadIds.length} ungelesene in ${scopeName} als gelesen markieren`,
    setKind: (next: NotificationKind) => update({ ansicht: next === "watching" ? "beobachtet" : undefined }),
    setUnreadOnly: (next: boolean) => update({ nur: next ? "ungelesen" : undefined }),
    setQuery: (next: string) => update({ suche: next || undefined }, true),
    markScopeRead,
    toggleGroupRead: (group: FeedGroup<JiraNotification>) => setRead(group.items.map((item) => item.id), group.unread > 0),
    openItem: (item: JiraNotification) => openNotification(item, (key, commentId) =>
        void navigate({ to: "/issue/$key", params: { key }, search: issueSearch(commentId) }),
      ),
    openExternal: (key: string) => siteUrl && void openUrl(`${siteUrl}/browse/${key}`),
  };
};
