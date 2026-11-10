type SearchableTab = { key: string; title?: string; label?: string };

export const searchOpenTabs = <T extends SearchableTab>(tabs: readonly T[], query: string): T[] => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return tabs.filter((tab) => {
    const text = `${tab.label ?? tab.key} ${tab.title ?? ""}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
};
