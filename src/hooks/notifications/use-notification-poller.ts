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
import { useNotificationSnoozeTimer } from "./use-notification-snooze-timer";

const POLL_INTERVAL = 20_000;

export const alertCooldown = new Map<string, number>();
let cooldownOwner: string | null = null;

export type AlertTargets = { issue: (key: string, commentId?: string) => void; inbox: () => void };

const storedOwner = () => useNotifications.getState().owner;

const systemGate = (currentOwner: () => string | null) => {
  const { system, systemEpoch } = useActivityAlertPrefs.getState();
  return { system, systemEpoch, owner: currentOwner() };
};

const showToast = (message: AlertMessage, items: JiraNotification[], open: AlertTargets, allowed: () => boolean) => {
  const [first] = items;
  toast(message.title, {
    description: message.body,
    action:
      message.issueKey && first
        ? { label: "Öffnen", onClick: () => { if (allowed()) openNotification(first, open.issue); } }
        : { label: "Anzeigen", onClick: open.inbox },
  });
};

export const deliverActivityAlerts = (
  fresh: JiraNotification[],
  focused: boolean | (() => boolean),
  open: AlertTargets,
  currentOwner: () => string | null = storedOwner,
  now = Date.now(),
): Promise<void> => {
  const owner = currentOwner();
  if (fresh.length === 0 || owner === null || owner !== storedOwner()) return Promise.resolve();
  if (cooldownOwner !== owner) {
    alertCooldown.clear();
    cooldownOwner = owner;
  }
  const isFocused = () => typeof focused === "function" ? focused() : focused;
  const prefs = useActivityAlertPrefs.getState();
  const channel = activityAlertChannel(isFocused(), prefs);
  if (!channel) return Promise.resolve();
  const items = alertableItems(fresh, prefs.watching, alertCooldown, now);
  const message = alertMessage(items);
  if (!message) return Promise.resolve();
  for (const item of items) alertCooldown.set(item.issueKey, now);
  const release = (delivered: readonly JiraNotification[]) => {
    const issues = new Set(delivered.map((item) => item.issueKey));
    for (const item of items) {
      if (!issues.has(item.issueKey) && cooldownOwner === owner && alertCooldown.get(item.issueKey) === now) alertCooldown.delete(item.issueKey);
    }
  };
  const guardedOpen: AlertTargets = {
    issue: (key, commentId) => { if (currentOwner() === owner && storedOwner() === owner) open.issue(key, commentId); },
    inbox: () => { if (currentOwner() === owner && storedOwner() === owner) open.inbox(); },
  };
  if (channel === "in-app") {
    showToast(message, items, guardedOpen, () => currentOwner() === owner && storedOwner() === owner);
    return Promise.resolve();
  }
  const before = systemGate(currentOwner);
  return Effect.runPromise(readSystemPermission.pipe(
    Effect.flatMap((permission) => {
      if (storedOwner() !== owner || !systemAlertStillAllowed(before, systemGate(currentOwner))) return Effect.succeed([]);
      const currentPrefs = useActivityAlertPrefs.getState();
      const readIds = new Set(useNotifications.getState().items.filter((item) => item.read).map((item) => item.id));
      const pending = items.filter((item) => !readIds.has(item.id) && (currentPrefs.watching || item.kind === "direct"));
      const updatedMessage = alertMessage(pending);
      if (!updatedMessage) return Effect.succeed([]);
      if (isFocused()) {
        if (!currentPrefs.inApp) return Effect.succeed([]);
        showToast(updatedMessage, pending, guardedOpen, () => currentOwner() === owner && storedOwner() === owner);
        return Effect.succeed(pending);
      }
      if (permission !== "granted") return Effect.succeed([]);
      return sendSystemNotification({ title: updatedMessage.title, body: updatedMessage.body }).pipe(Effect.as(pending));
    }),
    Effect.catch(() => Effect.succeed([])),
    Effect.map(release),
  ));
};

export const pollNotificationActivity = async (
  owner: string,
  me: string,
  signal: AbortSignal,
  open: AlertTargets,
  currentOwner: () => string | null,
  focused: () => boolean,
) => {
  const startedAt = Date.now();
  if (signal.aborted || currentOwner() !== owner) return startedAt;
  useNotifications.getState().adopt(owner);
  const { checkedAt } = useNotifications.getState();
  if (checkedAt === null) {
    useNotifications.getState().receive([], startedAt);
    return startedAt;
  }
  const activity = await Effect.runPromise(fetchActivity(me, checkedAt), { signal });
  const state = useNotifications.getState();
  if (signal.aborted || currentOwner() !== owner || state.owner !== owner || state.checkedAt !== checkedAt) return startedAt;
  const fresh = state.receive(activity, startedAt);
  void deliverActivityAlerts(fresh, focused, open, currentOwner);
  return startedAt;
};

export const useNotificationPoller = () => {
  useNotificationSnoozeTimer();
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
    queryFn: ({ signal }) => pollNotificationActivity(owner!, me!, signal, open, currentOwner, () => document.hasFocus()),
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
