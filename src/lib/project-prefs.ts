import { create } from "zustand";
import { persist } from "zustand/middleware";

type ProjectPrefsState = {
  projectIds: string[];
  hiddenProjectIds: string[];
  toggleProject: (id: string) => void;
  toggleHidden: (id: string) => void;
};

const toggle = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

export const useProjectPrefs = create<ProjectPrefsState>()(
  persist(
    (set) => ({
      projectIds: [],
      hiddenProjectIds: [],
      toggleProject: (id) => set(({ projectIds }) => ({ projectIds: toggle(projectIds, id) })),
      toggleHidden: (id) => set(({ hiddenProjectIds }) => ({ hiddenProjectIds: toggle(hiddenProjectIds, id) })),
    }),
    { name: "betterjira-favorites" },
  ),
);
