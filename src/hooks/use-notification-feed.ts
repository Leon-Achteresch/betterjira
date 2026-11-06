import { useState } from "react";
import { filterFeed, groupByIssue, type FeedGroup, type NotificationKind } from "@/lib/jira/notification-feed";
import { type JiraNotification, useNotifications } from "@/lib/jira/notifications";

export type NotificationGroup = FeedGroup<JiraNotification>;

const countUnread = (items: JiraNotification[], kind: NotificationKind) =>
  items.filter((item) => item.kind === kind && !item.read).length;

export const useNotificationFeed = () => {
  const items = useNotifications((state) => state.items);
  const setRead = useNotifications((state) => state.setRead);
  const markAllRead = useNotifications((state) => state.markAllRead);
  const [kind, setKind] = useState<NotificationKind>("direct");
  const [unreadOnly, setUnreadOnly] = useState(false);

  return {
    kind,
    setKind,
    unreadOnly,
    setUnreadOnly,
    groups: groupByIssue(filterFeed(items, kind, unreadOnly)),
    unreadByKind: { direct: countUnread(items, "direct"), watching: countUnread(items, "watching") },
    hasUnread: items.some((item) => !item.read),
    markAllRead,
    toggleGroupRead: (group: NotificationGroup) => setRead(group.items.map((item) => item.id), group.unread > 0),
  };
};
