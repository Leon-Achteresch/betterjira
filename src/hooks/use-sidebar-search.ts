import { useState } from "react";
import { useJiraFilters, useJiraProjects } from "@/lib/jira/queries";
import { useProjectPrefs } from "@/hooks/use-project-prefs";
import { groupProjects, normalizeNeedle, searchFilters } from "@/lib/sidebar-search";

export const useSidebarSearch = () => {
  const [query, setQuery] = useState("");
  const projects = useJiraProjects();
  const filters = useJiraFilters();
  const prefs = useProjectPrefs();
  const needle = normalizeNeedle(query);
  const grouped = groupProjects(projects.data ?? [], { needle, favoriteIds: prefs.favoriteIds, hiddenIds: prefs.hiddenIds });

  return {
    query,
    setQuery,
    searching: needle !== "",
    prefs,
    projects: { ...grouped, isPending: projects.isPending || prefs.pending, loaded: !!projects.data && !prefs.pending },
    filters: {
      items: searchFilters(filters.data ?? [], needle),
      isPending: filters.isPending,
      error: filters.error,
      loaded: !!filters.data,
    },
  };
};
