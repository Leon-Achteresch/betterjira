import { useCallback } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useJiraAccountScope } from "@/hooks/jira/use-jira-account-scope";
import { LOCAL_PREFERENCE_STORAGE } from "@/lib/local-preference-storage";
import {
  DEFAULT_INTERFACE_PREFERENCES,
  INTERFACE_STORAGE_KEY,
  interfaceAccount,
  readInterfacePreferences,
  updateInterfaceAccount,
  type InterfacePreferences,
} from "@/lib/interface-state";

type InterfaceState = InterfacePreferences & {
  setSidebarOpen: (open: boolean) => void;
  setSection: (scope: string | null, id: string, open: boolean) => void;
  setProject: (scope: string | null, id: string, open: boolean) => void;
  setTableSearch: (scope: string | null, id: string, text: string) => void;
};

export const useInterfaceState = create<InterfaceState>()(
  persist(
    (set) => ({
      ...DEFAULT_INTERFACE_PREFERENCES,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setSection: (scope, id, open) => set((state) => updateInterfaceAccount(state, scope, "sections", (current) => ({ ...current, [id]: open }))),
      setProject: (scope, id, open) => set((state) => updateInterfaceAccount(state, scope, "projects", (current) => ({ ...current, [id]: open }))),
      setTableSearch: (scope, id, text) => set((state) => updateInterfaceAccount(state, scope, "tableSearches", (current) => {
        const { [id]: _, ...rest } = current;
        return text === "" ? rest : { ...rest, [id]: text.slice(0, 1000) };
      })),
    }),
    {
      name: INTERFACE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => LOCAL_PREFERENCE_STORAGE),
      partialize: ({ sidebarOpen, accounts }) => readInterfacePreferences({ sidebarOpen, accounts }),
      migrate: (persisted) => readInterfacePreferences(persisted),
      merge: (persisted, current) => ({ ...current, ...readInterfacePreferences(persisted) }),
    },
  ),
);

export function useSidebarSection(id: string, defaultOpen = true) {
  const { scope } = useJiraAccountScope();
  const open = useInterfaceState((state) => interfaceAccount(state, scope).sections[id] ?? defaultOpen);
  const setSection = useInterfaceState((state) => state.setSection);
  const setOpen = useCallback((next: boolean) => setSection(scope, id, next), [scope, id, setSection]);
  return { open, setOpen };
}

export function useProjectExpansion(id: string, defaultOpen = false) {
  const { scope } = useJiraAccountScope();
  const open = useInterfaceState((state) => interfaceAccount(state, scope).projects[id] ?? defaultOpen);
  const setProject = useInterfaceState((state) => state.setProject);
  const setOpen = useCallback((next: boolean) => setProject(scope, id, next), [scope, id, setProject]);
  return { open, setOpen };
}

export function useTableSearch(id: string) {
  const { scope } = useJiraAccountScope();
  const text = useInterfaceState((state) => interfaceAccount(state, scope).tableSearches[id] ?? "");
  const setTableSearch = useInterfaceState((state) => state.setTableSearch);
  const setText = useCallback((next: string) => setTableSearch(scope, id, next), [scope, id, setTableSearch]);
  return { text, setText };
}
