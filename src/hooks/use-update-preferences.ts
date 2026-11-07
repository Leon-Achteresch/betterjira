import { create } from "zustand";
import { persist } from "zustand/middleware";

type UpdatePreferences = {
  autoCheck: boolean;
  autoInstall: boolean;
  setAutoCheck: (autoCheck: boolean) => void;
  setAutoInstall: (autoInstall: boolean) => void;
};

export const useUpdatePreferences = create<UpdatePreferences>()(
  persist(
    (set) => ({
      autoCheck: true,
      autoInstall: false,
      setAutoCheck: (autoCheck) => set({ autoCheck }),
      setAutoInstall: (autoInstall) => set({ autoInstall }),
    }),
    { name: "betterjira-update-preferences" },
  ),
);
