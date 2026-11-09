import { useZammadConnection } from "@/hooks/zammad/use-zammad-connection";
import { ticketOptions } from "@/hooks/zammad/use-zammad-queries";
import { tabTarget, zammadTabKey } from "@/lib/issue-tabs";
import { useQueries } from "@tanstack/react-query";
import { useMatch, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  addTab,
  issueKeyFromHref,
  keepOthers,
  keepUntil,
  neighborTab,
  orderTabs,
  removeTab,
} from "@/lib/issue-tabs";
import { issueQuery, useJiraSite } from "@/lib/jira/queries";

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
      close: (key) =>
        set(({ keys, pinned }) => ({
          keys: removeTab(keys, key),
          pinned: removeTab(pinned, key),
        })),
      togglePin: (key) =>
        set(({ pinned }) => ({
          pinned: pinned.includes(key)
            ? removeTab(pinned, key)
            : [...pinned, key],
        })),
      setKeys: (keys) => set({ keys }),
    }),
    { name: "betterjira-issue-tabs" },
  ),
);

export const useIssueTabs = () => {
  const { keys, pinned, close, togglePin, setKeys } = useIssueTabStore();
  const jiraKey = useMatch({ from: "/issue/$key", shouldThrow: false })?.params
    .key;
  const zammadId = useMatch({ from: "/helpdesk/$id", shouldThrow: false })
    ?.params.id;
  const activeKey = jiraKey ?? (zammadId ? zammadTabKey(zammadId) : undefined);
  const connection = useZammadConnection();
  const navigate = useNavigate();
  const site = useJiraSite();
  const ordered = orderTabs(keys, pinned);
  const jiraKeys = ordered.filter((key) => !key.startsWith("zammad:"));
  const zammadKeys = ordered.filter((key) => key.startsWith("zammad:"));
  const issues = useQueries({
    queries: jiraKeys.map((key) => ({
      ...issueQuery(key),
      enabled: !!site.data,
    })),
  });
  const zammad = useQueries({
    queries: zammadKeys.map((key) => ({
      ...ticketOptions(Number(key.slice(7))),
      enabled: !!connection.data,
    })),
  });
  const tabs = ordered.map((key) => {
    const isZammad = key.startsWith("zammad:");
    const ticket = isZammad ? zammad[zammadKeys.indexOf(key)]?.data : undefined;
    return {
      key,
      label: isZammad ? `#${ticket?.number ?? key.slice(7)}` : key,
      title: isZammad
        ? ticket?.title
        : issues[jiraKeys.indexOf(key)]?.data?.fields.summary,
      pinned: pinned.includes(key),
      target: tabTarget(key),
      source: isZammad ? ("zammad" as const) : ("jira" as const),
      url: isZammad
        ? connection.data
          ? `${connection.data.baseUrl}/#ticket/zoom/${key.slice(7)}`
          : undefined
        : site.data
          ? `${site.data.siteUrl}/browse/${key}`
          : undefined,
    };
  });
  const openTab = (key: string) => void navigate(tabTarget(key));

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
    if (activeKey && keys.includes(activeKey) && !remaining.includes(activeKey))
      openTab(key);
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
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.button !== 0 ||
        !(event.target instanceof Element)
      )
        return;
      const key = issueKeyFromHref(
        event.target.closest("a")?.getAttribute("href"),
      );
      if (!key) return;
      event.preventDefault();
      event.stopPropagation();
      useIssueTabStore.getState().open(key);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
};
