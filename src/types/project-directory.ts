import type { Ref } from "react";
import type { ProjectDirectoryState } from "@/hooks/jira/use-project-directory";
import type { ProjectView, ProjectSort } from "@/lib/project-directory";

export type ProjectDirectoryProps = {
  directory: ProjectDirectoryState;
  query: string;
  view: ProjectView;
  onQueryChange: (query: string) => void;
  sort: ProjectSort;
  onSortChange: (sort: ProjectSort) => void;
};

export type ProjectDirectoryRowProps = {
  entry: ProjectDirectoryState["entries"][number];
  onToggleFavorite: () => void;
  disabled?: boolean;
  ref?: Ref<HTMLLIElement>;
};
