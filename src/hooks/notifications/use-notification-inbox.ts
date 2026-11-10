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
import { openNotification, useNotifications, useOwnedCheckedAt, useOwnedNotifications } from "./use-notification-store";
import { useNotificationSync } from "./use-notification-sync";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const useNotificationInbox = () => {
  const search: InboxSearch = useSearch({ from: "/benachrichtigungen" });
  const navigate = useNavigate({ from: "/benachrichtigungen" });
  const siteUrl = useJiraSite().data?.siteUrl;
  const items = useOwnedNotifications();
  const checkedAt = useOwnedCheckedAt();
  const setRead = useNotifications((state) => state.setRead);
  const sync = useNotificationSync();

  const kind = inboxKindOf(search);
  const unreadOnly = search.nur === "ungelesen";
  const query = search.suche ?? "";
  const matching = searchFeed(items, query);
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

  return {
    kind,
    unreadOnly,
    query,
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
