import { useState } from "react";
import { useJiraFilters, useJiraProjects } from "@/lib/jira/queries";
import { useProjectPrefs } from "@/lib/project-prefs";
import { groupProjects, normalizeNeedle, searchFilters } from "@/lib/sidebar-search";

export const useSidebarSearch = () => {
  const [query, setQuery] = useState("");
  const projects = useJiraProjects();
  const filters = useJiraFilters();
  const favoriteIds = useProjectPrefs((state) => state.projectIds);
  const hiddenIds = useProjectPrefs((state) => state.hiddenProjectIds);
  const needle = normalizeNeedle(query);
  const grouped = groupProjects(projects.data ?? [], { needle, favoriteIds, hiddenIds });

  return {
    query,
    setQuery,
    searching: needle !== "",
    projects: { ...grouped, isPending: projects.isPending, loaded: !!projects.data },
    filters: {
      items: searchFilters(filters.data ?? [], needle),
      isPending: filters.isPending,
      error: filters.error,
      loaded: !!filters.data,
    },
  };
};
