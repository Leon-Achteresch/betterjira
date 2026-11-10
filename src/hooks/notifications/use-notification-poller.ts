import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Effect } from "effect";
import { toast } from "sonner";
import { issueSearch } from "@/lib/jira/issue-link";
import { fetchActivity, notificationKey, type JiraNotification } from "@/lib/jira/notifications";
import { jiraKeys, useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import {
  activityAlertChannel,
  alertableItems,
  alertMessage,
  type AlertMessage,
  systemAlertStillAllowed,
} from "@/lib/notifications/activity-alerts";
import { readSystemPermission, sendSystemNotification } from "@/lib/notifications/system-notifications";
import { workspaceId } from "@/lib/workspace";
import { useActivityAlertPrefs } from "./use-activity-alert-prefs";
import { openNotification, useNotificationOwner, useNotifications, useOwnedUnreadCount } from "./use-notification-store";

const POLL_INTERVAL = 20_000;

export const alertCooldown = new Map<string, number>();
let cooldownOwner: string | null = null;

export type AlertTargets = { issue: (key: string, commentId?: string) => void; inbox: () => void };

const storedOwner = () => useNotifications.getState().owner;

const systemGate = (currentOwner: () => string | null) => {
  const { system, systemEpoch } = useActivityAlertPrefs.getState();
  return { system, systemEpoch, owner: currentOwner() };
};

const notifySystem = (message: AlertMessage, currentOwner: () => string | null) => {
  const before = systemGate(currentOwner);
  return readSystemPermission.pipe(
    Effect.flatMap((permission) =>
      permission === "granted" && systemAlertStillAllowed(before, systemGate(currentOwner))
        ? sendSystemNotification({ title: message.title, body: message.body })
        : Effect.void,
    ),
    Effect.ignore,
  );
};

const showToast = (message: AlertMessage, items: JiraNotification[], open: AlertTargets) => {
  const [first] = items;
  toast(message.title, {
    description: message.body,
    action:
      message.issueKey && first
        ? { label: "Öffnen", onClick: () => openNotification(first, open.issue) }
        : { label: "Anzeigen", onClick: open.inbox },
  });
};

export const deliverActivityAlerts = (
  fresh: JiraNotification[],
  focused: boolean,
  open: AlertTargets,
  currentOwner: () => string | null = storedOwner,
  now = Date.now(),
): Promise<void> => {
  if (fresh.length === 0 || currentOwner() === null || currentOwner() !== storedOwner()) return Promise.resolve();
  if (cooldownOwner !== currentOwner()) {
    alertCooldown.clear();
    cooldownOwner = currentOwner();
  }
  const prefs = useActivityAlertPrefs.getState();
  const channel = activityAlertChannel(focused, prefs);
  if (!channel) return Promise.resolve();
  const items = alertableItems(fresh, prefs.watching, alertCooldown, now);
  const message = alertMessage(items);
  if (!message) return Promise.resolve();
  for (const item of items) alertCooldown.set(item.issueKey, now);
  if (channel === "system") return Effect.runPromise(notifySystem(message, currentOwner));
  showToast(message, items, open);
  return Promise.resolve();
};

export const useNotificationPoller = () => {
  const owner = useNotificationOwner();
  const me = useJiraMyself().data?.accountId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentOwner = () => {
    const site = queryClient.getQueryData<ReturnType<typeof useJiraSite>["data"]>(jiraKeys.site);
    const myself = queryClient.getQueryData<ReturnType<typeof useJiraMyself>["data"]>(jiraKeys.myself);
    return site && myself ? workspaceId(site.cloudId, myself.accountId) : null;
  };
  const open: AlertTargets = {
    issue: (key, commentId) => void navigate({ to: "/issue/$key", params: { key }, search: issueSearch(commentId) }),
    inbox: () => void navigate({ to: "/benachrichtigungen" }),
  };

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
      void deliverActivityAlerts(fresh, document.hasFocus(), open, currentOwner);
      return startedAt;
    },
    enabled: owner !== null && !!me,
    refetchInterval: POLL_INTERVAL,
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
