import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { Effect } from "effect";
import { toast } from "sonner";
import { fetchActivity, notificationKey, type JiraNotification } from "@/lib/jira/notifications";
import { useJiraMyself } from "@/lib/jira/queries";
import { openNotification, useNotificationOwner, useNotifications, useOwnedUnreadCount } from "./use-notification-store";

const BASE_INTERVAL = 10_000;
const MAX_INTERVAL = 60_000;
let quietPolls = 0;

const pollInterval = () => (document.hasFocus() ? BASE_INTERVAL : Math.min(BASE_INTERVAL * 2 ** quietPolls, MAX_INTERVAL));

const MAX_NATIVE = 3;

const notifyNative = async (fresh: JiraNotification[]) => {
  const granted = (await isPermissionGranted()) || (await requestPermission()) === "granted";
  if (!granted) return;
  const shown = fresh.slice(0, MAX_NATIVE);
  for (const item of shown) {
    sendNotification({ title: `${item.issueKey} · ${item.actor.displayName}`, body: `${item.title}: ${item.body}` });
  }
  if (fresh.length > shown.length) {
    sendNotification({ title: "betterjira", body: `${fresh.length - shown.length} weitere Benachrichtigungen` });
  }
};

const deliver = (fresh: JiraNotification[], openIssue: (key: string) => void) => {
  if (fresh.length === 0) return;
  if (!document.hasFocus()) return void notifyNative(fresh).catch(() => undefined);
  for (const item of fresh.slice(0, MAX_NATIVE)) {
    toast(`${item.issueKey} · ${item.actor.displayName} ${item.title}`, {
      description: item.body,
      action: { label: "Öffnen", onClick: () => openNotification(item, openIssue) },
    });
  }
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
      deliver(fresh, openIssue);
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
