import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { type BoardSprint, areaContent, areaJql, areaSubtitle } from "@/lib/jira/area-page";
import { jiraErrors } from "@/lib/jira/field-values";
import { useJiraProjectBoards, useJiraProjects } from "@/lib/jira/queries";

export function useAreaPage() {
  const { key } = useParams({ from: "/bereiche/$key" });
  const { board: boardId, sprint } = useSearch({ from: "/bereiche/$key" });
  const navigate = useNavigate({ from: "/bereiche/$key" });
  const session = useJiraSession();
  const projects = useJiraProjects();
  const boards = useJiraProjectBoards(key);
  const content = areaContent({ boardId, boards: boards.data?.values, failed: boards.isError });

  return {
    key,
    boardId,
    sprint,
    session,
    project: projects.data?.find((project) => project.key === key),
    subtitle: areaSubtitle(key, boardId, content.kind === "board" ? content.board.name : undefined),
    allJql: areaJql(key),
    content,
    boards: {
      errorMessage: jiraErrors(boards.error).messages.join(" "),
      refreshFailed: !!boards.data && boards.isError,
      retrying: boards.isFetching,
      retry: () => void boards.refetch(),
    },
    showAll: () => void navigate({ search: { board: undefined, sprint: undefined } }),
    changeSprint: (next?: BoardSprint) => void navigate({ search: (prev) => ({ ...prev, sprint: next }) }),
  };
}
