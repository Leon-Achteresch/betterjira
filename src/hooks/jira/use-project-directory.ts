import { useJiraProjects } from "@/lib/jira/queries";
import { projectDirectory, type ProjectView } from "@/lib/project-directory";
import { useProjectPrefs } from "@/lib/project-prefs";

export function useProjectDirectory({ query, view }: { query: string; view: ProjectView }) {
  const projects = useJiraProjects();
  const favoriteIds = useProjectPrefs((state) => state.projectIds);
  const hiddenIds = useProjectPrefs((state) => state.hiddenProjectIds);
  const toggleFavorite = useProjectPrefs((state) => state.toggleProject);
  const directory = projectDirectory(projects.data ?? [], { query, view, favoriteIds, hiddenIds });

  return {
    ...directory,
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
