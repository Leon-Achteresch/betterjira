import { systemAlertStatus } from "@/lib/notifications/activity-alerts";
import { useActivityAlertPrefs } from "./use-activity-alert-prefs";
import { useRequestSystemNotificationPermission, useSystemNotificationPermission } from "./use-system-notification-permission";

export const useActivityAlertSettings = () => {
  const { inApp, system, setInApp, setSystem } = useActivityAlertPrefs();
  const permission = useSystemNotificationPermission(system);
  const request = useRequestSystemNotificationPermission();

  return {
    inApp,
    onInAppChange: setInApp,
    system,
    onSystemChange: (enabled: boolean) => {
      request.reset();
      setSystem(enabled);
    },
    systemStatus: systemAlertStatus(system, permission),
    checking: permission.isFetching,
    onRecheck: () => void permission.refetch(),
    requesting: request.isPending,
    requestError: request.error?.message ?? null,
    onRequestPermission: () => {
      if (request.isPending || !system) return;
      request.mutate();
    },
  };
};
