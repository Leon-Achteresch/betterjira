import { useJiraProjects } from "@/lib/jira/queries";
import { projectDirectory, type ProjectView, type ProjectSort } from "@/lib/project-directory";
import { useProjectPrefs } from "@/hooks/use-project-prefs";

export function useProjectDirectoryData({ query, view, sort }: { query: string; view: ProjectView; sort?: ProjectSort }) {
  const projects = useJiraProjects();
  const { favoriteIds, hiddenIds, toggleFavorite, ready } = useProjectPrefs();
  const directory = projectDirectory(projects.data ?? [], { query, view, sort, favoriteIds, hiddenIds });

  return {
    ...directory,
    loaded: !!projects.data,
    isPending: projects.isPending,
    loadError: projects.data ? null : projects.error,
    refreshError: projects.data ? projects.error : null,
    isFetching: projects.isFetching,
    retry: () => void projects.refetch({ cancelRefetch: false }),
    toggleFavorite,
    favoriteDisabled: !ready,
  };
}
