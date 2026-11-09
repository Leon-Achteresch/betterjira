import { useCallback } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useJiraAccountScope } from "@/hooks/jira/use-jira-account-scope";
import {
  adoptLegacyProjectPrefs,
  EMPTY_PROJECT_PREFS_STORE,
  readProjectPrefsStore,
  scopedProjectPrefs,
  toggleProjectPref,
  type ProjectPrefList,
  type ProjectPrefs,
  type ProjectPrefsStore,
} from "@/lib/project-prefs";

type ProjectPrefsState = ProjectPrefsStore & {
  toggle: (scope: string, list: ProjectPrefList, id: string) => void;
  adoptLegacy: (scope: string) => void;
  setLegacy: (legacy: ProjectPrefs | null) => void;
};

export const useProjectPrefsStore = create<ProjectPrefsState>()(
  persist(
    (set) => ({
      ...EMPTY_PROJECT_PREFS_STORE,
      toggle: (scope, list, id) => set((state) => toggleProjectPref(state, scope, list, id)),
      adoptLegacy: (scope) => set((state) => adoptLegacyProjectPrefs(state, scope)),
      setLegacy: (legacy) => set({ legacy }),
    }),
    {
      name: "betterjira-favorites",
      partialize: ({ scopes, legacy }) => ({ scopes, legacy }),
      merge: (persisted, current) => ({ ...current, ...readProjectPrefsStore(persisted) }),
    },
  ),
);

export function useProjectPrefs() {
  const { scope, pending } = useJiraAccountScope();
  const prefs = useProjectPrefsStore((state) => scopedProjectPrefs(state, scope));
  const toggle = useProjectPrefsStore((state) => state.toggle);
  const toggleFavorite = useCallback(
    (id: string) => {
      if (scope !== null) toggle(scope, "favoriteIds", id);
    },
    [scope, toggle],
  );
  const toggleHidden = useCallback(
    (id: string) => {
      if (scope !== null) toggle(scope, "hiddenIds", id);
    },
    [scope, toggle],
  );
  return {
    ready: scope !== null,
    pending,
    favoriteIds: prefs.favoriteIds,
    hiddenIds: prefs.hiddenIds,
    toggleFavorite,
    toggleHidden,
  };
}

export type ProjectPrefsControls = ReturnType<typeof useProjectPrefs>;

export function useLegacyProjectPrefs() {
  const { scope, accountLabel } = useJiraAccountScope();
  const legacy = useProjectPrefsStore((state) => (scope === null ? null : state.legacy));
  const adoptLegacy = useProjectPrefsStore((state) => state.adoptLegacy);
  const setLegacy = useProjectPrefsStore((state) => state.setLegacy);

  const adopt = () => {
    if (scope === null || useProjectPrefsStore.getState().legacy === null) return;
    adoptLegacy(scope);
    toast.success("Favoriten und ausgeblendete Bereiche übernommen");
  };

  const discard = () => {
    const previous = useProjectPrefsStore.getState().legacy;
    if (previous === null) return;
    setLegacy(null);
    toast("Frühere Einstellungen verworfen", {
      action: { label: "Rückgängig", onClick: () => setLegacy(previous) },
    });
  };

  return { legacy, adopt, discard, accountLabel };
}
