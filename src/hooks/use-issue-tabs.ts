import { useQueries } from "@tanstack/react-query";
import { useZammadConnection } from "@/hooks/zammad/use-zammad-connection";
import { ticketOptions, useZammadTicket } from "@/hooks/zammad/use-zammad-queries";
import { tabTarget, zammadTabKey } from "@/lib/issue-tabs";

import { useMatch, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useConfirmedWorkspace } from "@/hooks/jira/use-confirmed-workspace";
import { useIssueTabStore } from "@/hooks/use-issue-tab-store";
import {
  EMPTY_TAB_SET,
  adoptLegacyTabs,
  discardLegacyTabs,
  legacyTabsLabel,
  restoreLegacyTabs,
  tabsOf,
  undoLegacyAdoption,
  withKeys,
  withoutTab,
  withPinToggled,
} from "@/lib/issue-tab-scopes";
import { issueKeyFromHref, keepOthers, keepUntil, neighborTab, orderTabs } from "@/lib/issue-tabs";
import { useJiraSite } from "@/lib/jira/queries";
import { useJiraIssue } from "@/hooks/jira/use-jira-issue";

import { useIssueTabMetadata } from "@/hooks/jira/use-issue-tab-metadata";

export { useIssueTabStore } from "@/hooks/use-issue-tab-store";

const useScopedTabs = (id: string | undefined) =>
  useIssueTabStore((state) => (id && state.scope === id ? tabsOf(state, id) : EMPTY_TAB_SET));

const useTicketTabScope = () => {
  const workspace = useConfirmedWorkspace();
  const connection = useZammadConnection();
  return workspace?.id ?? (connection.data ? JSON.stringify(["zammad", connection.data.baseUrl]) : undefined);
};

export const useIssueTabs = () => {
  const id = useTicketTabScope();
  const { keys, pinned } = useScopedTabs(id);
  const jiraKey = useMatch({ from: "/issue/$key", shouldThrow: false })?.params.key;
  const zammadId = useMatch({ from: "/helpdesk/$id", shouldThrow: false })?.params.id;
  const activeKey = zammadId ? zammadTabKey(zammadId) : jiraKey;
  const navigate = useNavigate();
  const site = useJiraSite();


  const ordered = orderTabs(keys, pinned);
  const jiraKeys = ordered.filter((key) => !key.startsWith("zammad:"));
  const zammadKeys = ordered.filter((key) => key.startsWith("zammad:"));
  const titles = useIssueTabMetadata(jiraKeys, jiraKey);
  const connection = useZammadConnection();
  const tickets = useQueries({ queries: zammadKeys.map((key) => ({ ...ticketOptions(Number(key.slice(7))), enabled: !!connection.data })) });
  const tabs = ordered.map((key) => {
    const source = key.startsWith("zammad:") ? "zammad" as const : "jira" as const;
    const ticket = tickets[zammadKeys.indexOf(key)]?.data;
    return {
      key,
      source,
      label: source === "zammad" ? `#${ticket?.number ?? key.slice(7)}` : key,
      title: source === "zammad" ? ticket?.title : titles[jiraKeys.indexOf(key)],
      pinned: pinned.includes(key),
      url: source === "zammad"
        ? connection.data ? `${connection.data.baseUrl}/#ticket/zoom/${key.slice(7)}` : undefined
        : site.data ? `${site.data.siteUrl}/browse/${key}` : undefined,
    };
  });

  const live = () => useIssueTabStore.getState().isCurrent(id);

  const openTab = (key: string) => {
    if (live()) void navigate(tabTarget(key));
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
  const id = useTicketTabScope();
  useEffect(() => {
    useIssueTabStore.getState().setScope(id);
  }, [id]);
};

export const useRememberIssueTab = (key: string) => {
  const workspace = useConfirmedWorkspace();
  const issue = useJiraIssue(key);
  const id = workspace?.id;
  const current = useIssueTabStore((state) => state.scope);
  const loaded = !!id && current === id && !!issue.data;

  useEffect(() => {
    if (id && loaded) useIssueTabStore.getState().remember(id, key);
  }, [id, key, loaded]);
};

export const useRememberZammadTab = (input: string) => {
  const id = useTicketTabScope();
  const number = /^\d+$/.test(input) && Number.isSafeInteger(Number(input)) ? Number(input) : 0;
  const ticket = useZammadTicket(number);
  const current = useIssueTabStore((state) => state.scope);
  const loaded = !!id && current === id && !!ticket.data;
  useEffect(() => {
    if (id && loaded) useIssueTabStore.getState().remember(id, zammadTabKey(number));
  }, [id, number, loaded]);
};

export const useLegacyIssueTabs = () => {
  const workspace = useConfirmedWorkspace();
  const [dialog, setDialog] = useState({ scope: workspace?.id, open: false });
  if (dialog.scope !== workspace?.id) setDialog({ scope: workspace?.id, open: false });
  const setOpen = (open: boolean) => setDialog({ scope: workspace?.id, open });
  const legacy = useIssueTabStore((state) => (workspace && state.scope === workspace.id ? state.legacy : undefined));
  if (!workspace || !legacy) return undefined;
  const { id } = workspace;

  const adopt = () => {
    setOpen(false);
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
    setOpen(false);
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
    open: dialog.scope === id && dialog.open,
    onOpenChange: setOpen,
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
