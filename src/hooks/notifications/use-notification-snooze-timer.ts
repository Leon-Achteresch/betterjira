import { useEffect } from "react";
import { useNotificationOwner, useNotifications, useOwnedSnoozes } from "./use-notification-store";

export const useNotificationSnoozeTimer = () => {
  const owner = useNotificationOwner();
  const snoozed = useOwnedSnoozes();
  useEffect(() => {
    if (!owner || Object.keys(snoozed).length === 0) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      const state = useNotifications.getState();
      if (state.owner !== owner) return;
      state.wakeDue();
      const upcoming = Object.values(useNotifications.getState().snoozed);
      if (upcoming.length > 0) timer = setTimeout(check, Math.max(1, Math.min(60_000, Math.min(...upcoming) - Date.now())));
    };
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [owner, snoozed]);
};
