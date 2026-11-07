import { useQueries } from "@tanstack/react-query";
import { useMatch, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { useConfirmedWorkspace } from "@/hooks/jira/use-confirmed-workspace";
import { useIssueTabStore } from "@/hooks/use-issue-tab-store";
import {
  EMPTY_TAB_SET,
  adoptLegacyTabs,
  discardLegacyTabs,
  issueLoadedInScope,
  legacyTabsLabel,
  restoreLegacyTabs,
  tabsOf,
  undoLegacyAdoption,
  withKeys,
  withoutTab,
  withPinToggled,
} from "@/lib/issue-tab-scopes";
import { issueKeyFromHref, keepOthers, keepUntil, neighborTab, orderTabs } from "@/lib/issue-tabs";
import { issueQuery, useJiraIssue, useJiraSite } from "@/lib/jira/queries";

export { useIssueTabStore } from "@/hooks/use-issue-tab-store";

const useScopedTabs = (id: string | undefined) =>
  useIssueTabStore((state) => (id && state.scope === id ? tabsOf(state, id) : EMPTY_TAB_SET));

export const useIssueTabs = () => {
  const id = useConfirmedWorkspace()?.id;
  const { keys, pinned } = useScopedTabs(id);
  const activeKey = useMatch({ from: "/issue/$key", shouldThrow: false })?.params.key;
  const navigate = useNavigate();
  const site = useJiraSite();
  const ordered = orderTabs(keys, pinned);
  const issues = useQueries({ queries: ordered.map((key) => ({ ...issueQuery(key), enabled: !!site.data })) });

  const tabs = ordered.map((key, index) => ({
    key,
    title: issues[index]?.data?.fields.summary,
    pinned: pinned.includes(key),
    url: site.data ? `${site.data.siteUrl}/browse/${key}` : undefined,
  }));

  const live = () => useIssueTabStore.getState().isCurrent(id);

  const openTab = (key: string) => {
    if (live()) void navigate({ to: "/issue/$key", params: { key } });
  };

  const closeTab = (key: string) => {
    if (!live()) return;
    if (key === activeKey) {
      const next = neighborTab(ordered, key);
      if (next) openTab(next);
      else void navigate({ to: "/" });
    }
    useIssueTabStore.getState().editTabs(id, (current) => withoutTab(current, key));
  };

  const keepTabs = (key: string, keep: typeof keepOthers) => {
    if (!live()) return;
    const remaining = keep(keys, pinned, key);
    if (activeKey && keys.includes(activeKey) && !remaining.includes(activeKey)) openTab(key);
    useIssueTabStore.getState().editTabs(id, (current) => withKeys(current, keep(current.keys, current.pinned, key)));
  };

  return {
    tabs,
    activeKey,
    openTab,
    closeTab,
    togglePin: (key: string) => useIssueTabStore.getState().editTabs(id, (current) => withPinToggled(current, key)),
    closeOthers: (key: string) => keepTabs(key, keepOthers),
    closeRight: (key: string) => keepTabs(key, keepUntil),
  };
};

export const useIssueTabScopeSync = () => {
  const id = useConfirmedWorkspace()?.id;
  useEffect(() => {
    useIssueTabStore.getState().setScope(id);
  }, [id]);
};

export const useRememberIssueTab = (key: string) => {
  const workspace = useConfirmedWorkspace();
  const issue = useJiraIssue(key);
  const id = workspace?.id;
  const loaded =
    !!workspace &&
    issueLoadedInScope({ loaded: issue.isSuccess, loadedAt: issue.dataUpdatedAt, confirmedAt: workspace.confirmedAt });

  useEffect(() => {
    if (id && loaded) useIssueTabStore.getState().remember(id, key);
  }, [id, key, loaded]);
};

export const useLegacyIssueTabs = () => {
  const workspace = useConfirmedWorkspace();
  const legacy = useIssueTabStore((state) => (workspace && state.scope === workspace.id ? state.legacy : undefined));
  if (!workspace || !legacy) return undefined;
  const { id } = workspace;

  const adopt = () => {
    const store = useIssueTabStore.getState();
    const taken = store.legacy;
    if (!store.isCurrent(id) || !taken) return;
    const before = tabsOf(store, id);
    store.edit(id, (stored) => adoptLegacyTabs(stored, id));
    toast(`${legacyTabsLabel(taken.keys.length)} übernommen`, {
      action: {
        label: "Rückgängig",
        onClick: () => useIssueTabStore.getState().edit(id, (stored) => undoLegacyAdoption(stored, id, before, taken)),
      },
    });
  };

  const discard = () => {
    const store = useIssueTabStore.getState();
    const taken = store.legacy;
    if (!store.isCurrent(id) || !taken) return;
    store.edit(id, discardLegacyTabs);
    toast(`${legacyTabsLabel(taken.keys.length)} verworfen`, {
      action: {
        label: "Rückgängig",
        onClick: () => useIssueTabStore.getState().edit(id, (stored) => restoreLegacyTabs(stored, taken)),
      },
    });
  };

  return {
    keys: legacy.keys,
    pinned: legacy.pinned,
    label: legacyTabsLabel(legacy.keys.length),
    siteName: workspace.siteName,
    onAdopt: adopt,
    onDiscard: discard,
  };
};

export const useBackgroundTabClick = () => {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.button !== 0 || !(event.target instanceof Element)) return;
      const key = issueKeyFromHref(event.target.closest("a")?.getAttribute("href"));
      if (!key) return;
      event.preventDefault();
      event.stopPropagation();
      useIssueTabStore.getState().open(key);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
};
