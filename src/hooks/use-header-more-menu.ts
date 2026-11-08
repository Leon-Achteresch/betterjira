import { useThemeCycle } from "@/hooks/use-theme";

export function useHeaderMoreMenu<T extends { key: string }>(tabs: readonly T[], activeKey: string | undefined) {
  const theme = useThemeCycle();
  return { theme, activeTab: tabs.find((tab) => tab.key === activeKey) };
}
