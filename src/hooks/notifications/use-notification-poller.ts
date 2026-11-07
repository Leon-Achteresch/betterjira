import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Effect } from "effect";
import { toast } from "sonner";
import { fetchActivity, notificationKey, type JiraNotification } from "@/lib/jira/notifications";
import { useJiraMyself } from "@/lib/jira/queries";
import {
  activityAlertChannel,
  MAX_ACTIVITY_ALERTS,
  systemAlertMessages,
  systemAlertStillAllowed,
} from "@/lib/notifications/activity-alerts";
import { readSystemPermission, sendSystemNotification } from "@/lib/notifications/system-notifications";
import { useActivityAlertPrefs } from "./use-activity-alert-prefs";
import { openNotification, useNotificationOwner, useNotifications, useOwnedUnreadCount } from "./use-notification-store";

const BASE_INTERVAL = 30_000;
const MAX_INTERVAL = 5 * 60_000;
let quietPolls = 0;

const pollInterval = () => (document.hasFocus() ? BASE_INTERVAL : Math.min(BASE_INTERVAL * 2 ** quietPolls, MAX_INTERVAL));

const systemGate = () => {
  const { system, systemEpoch } = useActivityAlertPrefs.getState();
  return { system, systemEpoch, owner: useNotifications.getState().owner };
};

const notifySystem = (fresh: JiraNotification[]) => {
  const before = systemGate();
  return readSystemPermission.pipe(
    Effect.flatMap((permission) =>
      permission === "granted" && systemAlertStillAllowed(before, systemGate())
        ? Effect.forEach(systemAlertMessages(fresh), sendSystemNotification, { discard: true })
        : Effect.void,
    ),
    Effect.ignore,
  );
};

const showToasts = (fresh: JiraNotification[], openIssue: (key: string) => void) => {
  for (const item of fresh.slice(0, MAX_ACTIVITY_ALERTS)) {
    toast(`${item.issueKey} · ${item.actor.displayName} ${item.title}`, {
      description: item.body,
      action: { label: "Öffnen", onClick: () => openNotification(item, openIssue) },
    });
  }
};

export const deliverActivityAlerts = (fresh: JiraNotification[], focused: boolean, openIssue: (key: string) => void): Promise<void> => {
  if (fresh.length === 0) return Promise.resolve();
  const channel = activityAlertChannel(focused, useActivityAlertPrefs.getState());
  if (channel === "system") return Effect.runPromise(notifySystem(fresh));
  if (channel === "in-app") showToasts(fresh, openIssue);
  return Promise.resolve();
};

export const useNotificationPoller = () => {
  const owner = useNotificationOwner();
  const me = useJiraMyself().data?.accountId;
  const navigate = useNavigate();
  const openIssue = (key: string) => void navigate({ to: "/issue/$key", params: { key } });

  useQuery({
    queryKey: notificationKey(owner ?? ""),
    queryFn: async ({ signal }) => {
      const startedAt = Date.now();
      useNotifications.getState().adopt(owner!);
      const { checkedAt, receive } = useNotifications.getState();
      if (checkedAt === null) {
        receive([], startedAt);
        return startedAt;
      }
      const activity = await Effect.runPromise(fetchActivity(me!, checkedAt), { signal });
      if (useNotifications.getState().owner !== owner) return startedAt;
      const fresh = receive(activity, startedAt);
      quietPolls = fresh.length > 0 ? 0 : quietPolls + 1;
      void deliverActivityAlerts(fresh, document.hasFocus(), openIssue);
      return startedAt;
    },
    enabled: owner !== null && !!me,
    refetchInterval: pollInterval,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    staleTime: 0,
    gcTime: 0,
  });

  const unread = useOwnedUnreadCount();
  useEffect(() => {
    void getCurrentWindow().setBadgeCount(unread || undefined).catch(() => undefined);
  }, [unread]);
};
