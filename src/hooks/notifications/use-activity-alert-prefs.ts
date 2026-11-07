import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ACTIVITY_ALERT_STORAGE_KEY,
  ACTIVITY_ALERT_STORAGE_VERSION,
  type ActivityAlertPrefs,
  DEFAULT_ACTIVITY_ALERT_PREFS,
  parseActivityAlertPrefs,
} from "@/lib/notifications/activity-alerts";

type ActivityAlertState = ActivityAlertPrefs & {
  systemEpoch: number;
  setInApp: (inApp: boolean) => void;
  setSystem: (system: boolean) => void;
};

export const useActivityAlertPrefs = create<ActivityAlertState>()(
  persist(
    (set) => ({
      ...DEFAULT_ACTIVITY_ALERT_PREFS,
      systemEpoch: 0,
      setInApp: (inApp) => set({ inApp }),
      setSystem: (system) => set(({ systemEpoch }) => ({ system, systemEpoch: systemEpoch + 1 })),
    }),
    {
      name: ACTIVITY_ALERT_STORAGE_KEY,
      version: ACTIVITY_ALERT_STORAGE_VERSION,
      partialize: ({ inApp, system }) => ({ inApp, system }),
      migrate: parseActivityAlertPrefs,
      merge: (persisted, current) => ({ ...current, ...parseActivityAlertPrefs(persisted) }),
    },
  ),
);
