import { useNavigate } from "@tanstack/react-router";
import { useProjectDirectoryData } from "./use-project-directory-data";
import { projectDirectorySearch, projectSortOf, projectViewOf, type ProjectDirectorySearch, type ProjectSort } from "@/lib/project-directory";

export function useProjectDirectory(search: ProjectDirectorySearch) {
  const query = search.q ?? "";
  const view = projectViewOf(search.ansicht);
  const sort = projectSortOf(search.sort);
  const navigate = useNavigate({ from: "/bereiche/" });
  const directory = useProjectDirectoryData({ query, view, sort });
  return {
    ...directory, query, view, sort,
    changeSort: (next: ProjectSort) => void navigate({ search: (previous) => projectDirectorySearch({ ...previous, sort: next }) }),
    changeQuery: (next: string) => void navigate({ search: (previous) => projectDirectorySearch({ ...previous, q: next }), replace: true }),
  };
}

export type ProjectDirectoryState = ReturnType<typeof useProjectDirectory>;