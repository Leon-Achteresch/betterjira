import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { jiraAgile } from "@/lib/jira/client";
import { BoardPage, BoardConfiguration, boardSprints, boardWithIssues, type JiraBoard } from "@/lib/jira/board";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";

export const useJiraProjectBoards = (key: string) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.projectBoards(key),
    queryFn: ({ signal }) =>
      Effect.runPromise(
        jiraAgile(`/board?projectLocation=${encodeURIComponent(key)}&maxResults=50`, BoardPage).pipe(
          Effect.map(({ values }) => ({ values: values.filter((board) => board.location?.projectKey === key) })),
        ),
        { signal },
      ),
    enabled: !!site.data,
  });
};

export const useJiraBacklogJql = (board: JiraBoard) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.boardConfig(board.id),
    queryFn: ({ signal }) => Effect.runPromise(jiraAgile(`/board/${board.id}/configuration`, BoardConfiguration), { signal }),
    select: (config) =>
      `filter = ${config.filter.id} AND (sprint is EMPTY OR sprint not in openSprints() AND sprint not in futureSprints()) AND statusCategory != Done ORDER BY Rank ASC`,
    enabled: !!site.data,
  });
};

export const useJiraBoardSprints = (board: JiraBoard) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.boardSprints(board.id),
    queryFn: ({ signal }) => Effect.runPromise(boardSprints(board.id), { signal }),
    enabled: !!site.data && board.type === "scrum",
  });
};

export const useJiraBoard = (board: JiraBoard, sprintId?: number, enabled = true) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.board(board.id, sprintId),
    queryFn: ({ signal }) => Effect.runPromise(boardWithIssues(board, sprintId), { signal }),
    enabled: !!site.data && enabled,
  });
};
