import { useState } from "react";
import { countUnread, filterFeed, groupByIssue, type FeedGroup, type NotificationKind } from "@/lib/jira/notification-feed";
import type { JiraNotification } from "@/lib/jira/notifications";
import { useNotifications, useOwnedNotifications } from "./use-notification-store";

export type NotificationGroup = FeedGroup<JiraNotification>;

export const useNotificationFeed = () => {
  const items = useOwnedNotifications();
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
    unreadByKind: countUnread(items),
    hasUnread: items.some((item) => !item.read),
    markAllRead,
    toggleGroupRead: (group: NotificationGroup) => setRead(group.items.map((item) => item.id), group.unread > 0),
  };
};
