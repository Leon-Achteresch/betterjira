import { useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notificationKey } from "@/lib/jira/notifications";
import { useNotificationOwner } from "./use-notification-store";

export const useNotificationSync = () => {
  const client = useQueryClient();
  const key = notificationKey(useNotificationOwner() ?? "");
  const state = useSyncExternalStore(
    (onChange) => client.getQueryCache().subscribe(onChange),
    () => client.getQueryState(key),
  );
  return {
    failed: state?.status === "error",
    errorMessage: state?.error instanceof Error ? state.error.message : "",
    checking: state?.fetchStatus === "fetching",
    retry: () => void client.refetchQueries({ queryKey: key, type: "active" }),
  };
};
