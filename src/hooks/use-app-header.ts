import { useCanGoBack, useRouter } from "@tanstack/react-router";
import { useIssueTabs, useLegacyIssueTabs } from "@/hooks/use-issue-tabs";
import { useOpenTabSearch } from "@/hooks/use-open-tab-search";
import { useTabHotkeys } from "@/hooks/use-tab-hotkeys";

export function useAppHeader() {
  const tabs = useIssueTabs();
  const legacyTabs = useLegacyIssueTabs();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  useTabHotkeys({ keys: tabs.tabs.map((tab) => tab.key), activeKey: tabs.activeKey, openTab: tabs.openTab, closeTab: tabs.closeTab });
  const tabSearch = useOpenTabSearch({ tabs: tabs.tabs, onOpenTab: tabs.openTab });
  return {
    ...tabs,
    legacyTabs,
    tabSearch,
    canGoBack,
    back: () => router.history.back(),
    forward: () => router.history.forward(),
    createIssue: () => void router.navigate({ to: "/neu" }),
  };
}
