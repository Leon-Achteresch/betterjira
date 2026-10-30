import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_VIEW, type IssueView } from "@/lib/jira/issue-view";

export type SavedIssueView = IssueView & { name: string };

type IssueViewsState = {
  views: Record<string, Partial<IssueView>>;
  saved: Record<string, SavedIssueView[]>;
  update: (scope: string, update: (view: IssueView) => Partial<IssueView>) => void;
  reset: (scope: string) => void;
  save: (scope: string, name: string) => void;
  remove: (scope: string, name: string) => void;
};

export const useIssueViews = create<IssueViewsState>()(
  persist(
    (set) => ({
      views: {},
      saved: {},
      update: (scope, update) =>
        set(({ views }) => {
          const current = { ...DEFAULT_VIEW, ...views[scope] };
          return { views: { ...views, [scope]: { ...current, ...update(current) } } };
        }),
      reset: (scope) =>
        set(({ views }) => {
          const { [scope]: _, ...rest } = views;
          return { views: rest };
        }),
      save: (scope, name) =>
        set(({ views, saved }) => {
          const view = { ...DEFAULT_VIEW, ...views[scope], name };
          const others = (saved[scope] ?? []).filter((existing) => existing.name !== name);
          return { saved: { ...saved, [scope]: [...others, view] } };
        }),
      remove: (scope, name) =>
        set(({ saved }) => ({ saved: { ...saved, [scope]: (saved[scope] ?? []).filter((view) => view.name !== name) } })),
    }),
    { name: "betterjira-issue-views" },
  ),
);
