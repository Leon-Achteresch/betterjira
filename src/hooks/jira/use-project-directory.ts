import { useNavigate } from "@tanstack/react-router";
import { useJiraProjects } from "@/lib/jira/queries";
import { projectDirectory, projectDirectorySearch, projectSortOf, projectViewOf, type ProjectDirectorySearch, type ProjectSort } from "@/lib/project-directory";
import { useProjectPrefs } from "@/lib/project-prefs";

export function useProjectDirectory(search: ProjectDirectorySearch) {
  const query = search.q ?? "";
  const view = projectViewOf(search.ansicht);
  const sort = projectSortOf(search.sort);
  const navigate = useNavigate({ from: "/bereiche/" });
  const projects = useJiraProjects();
  const favoriteIds = useProjectPrefs((state) => state.projectIds);
  const hiddenIds = useProjectPrefs((state) => state.hiddenProjectIds);
  const toggleFavorite = useProjectPrefs((state) => state.toggleProject);
  const directory = projectDirectory(projects.data ?? [], { query, view, sort, favoriteIds, hiddenIds });

  return {
    ...directory,
    query,
    view,
    sort,
    changeSort: (next: ProjectSort) => void navigate({ search: (previous) => projectDirectorySearch({ ...previous, sort: next }) }),
    changeQuery: (next: string) => void navigate({ search: (previous) => projectDirectorySearch({ ...previous, q: next }), replace: true }),
    loaded: !!projects.data,
    isPending: projects.isPending,
    loadError: projects.data ? null : projects.error,
    refreshError: projects.data ? projects.error : null,
    isFetching: projects.isFetching,
    retry: () => void projects.refetch(),
    toggleFavorite,
  };
}

export type ProjectDirectoryState = ReturnType<typeof useProjectDirectory>;
