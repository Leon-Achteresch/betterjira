type Named = { id: string; name: string };

export const matchesNeedle = (needle: string, ...values: string[]) => values.some((value) => value.toLowerCase().includes(needle));

export const normalizeNeedle = (query: string) => query.trim().toLowerCase();

export const groupProjects = <T extends Named & { key: string }>(
  projects: readonly T[],
  { needle, favoriteIds, hiddenIds }: { needle: string; favoriteIds: readonly string[]; hiddenIds: readonly string[] },
) => {
  const visible = projects.filter((project) => !hiddenIds.includes(project.id) && matchesNeedle(needle, project.name, project.key));
  return {
    visible,
    favorites: visible.filter((project) => favoriteIds.includes(project.id)),
    others: visible.filter((project) => !favoriteIds.includes(project.id)),
  };
};

export const searchFilters = <T extends Named & { favourite?: boolean }>(filters: readonly T[], needle: string) =>
  filters.filter((filter) => matchesNeedle(needle, filter.name)).sort((a, b) => Number(!!b.favourite) - Number(!!a.favourite));
