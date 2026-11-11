import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_VIEW, type IssueView } from "@/lib/jira/issue-view";
import { LOCAL_PREFERENCE_STORAGE } from "@/lib/local-preference-storage";
import { readIssueViews } from "@/lib/view-preferences";

export type SavedIssueView = IssueView & { name: string };

type IssueViewsState = {
  views: Record<string, Partial<IssueView>>;
  saved: Record<string, SavedIssueView[]>;
  update: (scope: string, update: (view: IssueView) => Partial<IssueView>, fallback?: Partial<IssueView>) => void;
  reset: (scope: string) => void;
  save: (scope: string, name: string, fallback?: Partial<IssueView>) => void;
  remove: (scope: string, name: string) => void;
};

export const useIssueViews = create<IssueViewsState>()(
  persist(
    (set) => ({
      views: {},
      saved: {},
      update: (scope, update, fallback) =>
        set(({ views }) => {
          const current = { ...DEFAULT_VIEW, ...fallback, ...views[scope] };
          return { views: { ...views, [scope]: { ...current, ...update(current) } } };
        }),
      reset: (scope) =>
        set(({ views }) => {
          const { [scope]: _, ...rest } = views;
          return { views: rest };
        }),
      save: (scope, name, fallback) =>
        set(({ views, saved }) => {
          const view = { ...DEFAULT_VIEW, ...fallback, ...views[scope], name };
          const others = (saved[scope] ?? []).filter((existing) => existing.name !== name);
          return { saved: { ...saved, [scope]: [...others, view] } };
        }),
      remove: (scope, name) =>
        set(({ saved }) => ({ saved: { ...saved, [scope]: (saved[scope] ?? []).filter((view) => view.name !== name) } })),
    }),
    {
      name: "betterjira-issue-views",
      version: 1,
      storage: createJSONStorage(() => LOCAL_PREFERENCE_STORAGE),
      partialize: ({ views, saved }) => ({ views, saved }),
      migrate: (persisted) => readIssueViews(persisted),
      merge: (persisted, current) => ({ ...current, ...readIssueViews(persisted) }),
    },
  ),
);
