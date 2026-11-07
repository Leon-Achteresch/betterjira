import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  EMPTY_STORED_TABS,
  parseStoredIssueTabs,
  tabsOf,
  updateScopeTabs,
  withKeys,
  withoutTab,
  withPinToggled,
  withTab,
  type IssueTabSet,
  type StoredIssueTabs,
} from "@/lib/issue-tab-scopes";

export const ISSUE_TABS_STORAGE_KEY = "betterjira-issue-tabs";

type IssueTabsState = StoredIssueTabs &
  IssueTabSet & {
    scope: string | undefined;
    setScope: (scope: string | undefined) => void;
    isCurrent: (scope: string | undefined) => scope is string;
    edit: (scope: string | undefined, transform: (stored: StoredIssueTabs) => StoredIssueTabs) => void;
    editTabs: (scope: string | undefined, transform: (tabs: IssueTabSet) => IssueTabSet) => void;
    remember: (scope: string, key: string) => void;
    open: (key: string) => void;
    close: (key: string) => void;
    togglePin: (key: string) => void;
    setKeys: (keys: readonly string[]) => void;
  };

const withView = <T extends StoredIssueTabs & { scope: string | undefined }>(state: T) => ({
  ...state,
  ...tabsOf(state, state.scope),
});

export const useIssueTabStore = create<IssueTabsState>()(
  persist(
    (set, get) => {
      const isCurrent = (scope: string | undefined): scope is string => !!scope && get().scope === scope;
      const edit = (scope: string | undefined, transform: (stored: StoredIssueTabs) => StoredIssueTabs) => {
        if (isCurrent(scope)) set((state) => withView({ ...state, ...transform(state) }));
      };
      const editTabs = (scope: string | undefined, transform: (tabs: IssueTabSet) => IssueTabSet) => {
        if (isCurrent(scope)) set((state) => withView({ ...state, ...updateScopeTabs(state, scope, transform) }));
      };
      const editCurrent = (transform: (tabs: IssueTabSet) => IssueTabSet) => editTabs(get().scope, transform);
      return {
        ...EMPTY_STORED_TABS,
        keys: [],
        pinned: [],
        scope: undefined,
        setScope: (scope) => {
          if (get().scope !== scope) set((state) => withView({ ...state, scope }));
        },
        isCurrent,
        edit,
        editTabs,
        remember: (scope, key) => {
          if (tabsOf(get(), scope).keys.includes(key)) return;
          set((state) => withView({ ...state, ...updateScopeTabs(state, scope, (tabs) => withTab(tabs, key)) }));
        },
        open: (key) => editCurrent((tabs) => withTab(tabs, key)),
        close: (key) => editCurrent((tabs) => withoutTab(tabs, key)),
        togglePin: (key) => editCurrent((tabs) => withPinToggled(tabs, key)),
        setKeys: (keys) => editCurrent((tabs) => withKeys(tabs, keys)),
      };
    },
    {
      name: ISSUE_TABS_STORAGE_KEY,
      partialize: ({ workspaces, legacy }): StoredIssueTabs => ({ workspaces, legacy }),
      merge: (persisted, current) => withView({ ...current, ...parseStoredIssueTabs(persisted) }),
    },
  ),
);
