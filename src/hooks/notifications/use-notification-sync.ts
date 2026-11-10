import { useSyncExternalStore } from "react";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useDeviceOnline } from "@/hooks/connections/use-device-online";
import { deviceOnline } from "@/lib/connections/device-network";
import { notificationKey } from "@/lib/jira/notifications";
import { notificationSyncError, notificationSyncPhase } from "@/lib/jira/notification-sync";
import { useNotificationOwner } from "./use-notification-store";

export const useNotificationSync = () => {
  const client = useQueryClient();
  const key = notificationKey(useNotificationOwner() ?? "");
  const online = useDeviceOnline();
  const state = useSyncExternalStore(
    (onChange) => client.getQueryCache().subscribe(onChange),
    () => client.getQueryState(key),
  );
  const isActive = () => client.getQueryCache().find({ queryKey: key, exact: true })?.isActive() ?? false;
  const phase = notificationSyncPhase(state, isActive(), online);

  const check = () => {
    const current = notificationSyncPhase(client.getQueryState(key), isActive(), deviceOnline() && onlineManager.isOnline());
    if (current !== "ready") return;
    void client.refetchQueries({ queryKey: key, exact: true, type: "active" }, { cancelRefetch: false });
  };

  return {
    phase,
    failed: state?.status === "error",
    errorMessage: notificationSyncError(state?.error),
    checking: phase === "checking",
    retry: check,
  };
};
