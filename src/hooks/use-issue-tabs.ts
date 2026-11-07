import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useMatch, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addTab, issueKeyFromHref, keepOthers, keepUntil, neighborTab, orderTabs, removeTab } from "@/lib/issue-tabs";
import { issueQuery, useJiraSite } from "@/lib/jira/queries";
import { useJiraQueryScope } from "@/hooks/jira/use-jira-query-scope";

type IssueTabsState = {
  keys: string[];
  pinned: string[];
  open: (key: string) => void;
  close: (key: string) => void;
  togglePin: (key: string) => void;
  setKeys: (keys: string[]) => void;
};

export const useIssueTabStore = create<IssueTabsState>()(
  persist(
    (set) => ({
      keys: [],
      pinned: [],
      open: (key) => set(({ keys }) => ({ keys: addTab(keys, key) })),
      close: (key) => set(({ keys, pinned }) => ({ keys: removeTab(keys, key), pinned: removeTab(pinned, key) })),
      togglePin: (key) =>
        set(({ pinned }) => ({ pinned: pinned.includes(key) ? removeTab(pinned, key) : [...pinned, key] })),
      setKeys: (keys) => set({ keys }),
    }),
    { name: "betterjira-issue-tabs" },
  ),
);

export const useIssueTabs = () => {
  const { keys, pinned, close, togglePin, setKeys } = useIssueTabStore();
  const activeKey = useMatch({ from: "/issue/$key", shouldThrow: false })?.params.key;
  const navigate = useNavigate();
  const site = useJiraSite();
  const { scope } = useJiraQueryScope();
  const queryClient = useQueryClient();
  const ordered = orderTabs(keys, pinned);
  const issues = useQueries({ queries: ordered.map((key) => issueQuery(key, scope, queryClient)) });

  const tabs = ordered.map((key, index) => ({
    key,
    title: issues[index]?.data?.fields.summary,
    pinned: pinned.includes(key),
    url: site.data ? `${site.data.siteUrl}/browse/${key}` : undefined,
  }));

  const openTab = (key: string) => void navigate({ to: "/issue/$key", params: { key } });

  const closeTab = (key: string) => {
    if (key === activeKey) {
      const next = neighborTab(ordered, key);
      if (next) openTab(next);
      else void navigate({ to: "/" });
    }
    close(key);
  };

  const keepTabs = (key: string, keep: typeof keepOthers) => {
    const remaining = keep(keys, pinned, key);
    if (activeKey && keys.includes(activeKey) && !remaining.includes(activeKey)) openTab(key);
    setKeys(remaining);
  };

  return {
    tabs,
    activeKey,
    openTab,
    closeTab,
    togglePin,
    closeOthers: (key: string) => keepTabs(key, keepOthers),
    closeRight: (key: string) => keepTabs(key, keepUntil),
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
