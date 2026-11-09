import { useMemo } from "react";
import { boardQuery, boardConfigQuery } from "@/lib/jira/board-query";
import { boardGroups, type BoardIdentity } from "@/lib/jira/board";
import { useLoadMoreOnIntersection } from "@/hooks/use-load-more-on-intersection";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { jiraAgile } from "@/lib/jira/client";
import { BoardPage, boardSprints, type JiraBoard } from "@/lib/jira/board";
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
    ...boardConfigQuery(board.id),
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

export const useJiraBoard = (board: BoardIdentity, sprintId?: number, enabled = true) => {
  const site = useJiraSite();
  const client = useQueryClient();
  const query = useInfiniteQuery({
    ...boardQuery(client, board, sprintId),
    enabled: !!site.data && enabled,
  });
  const data = useMemo(() => query.data ? boardGroups(query.data) : undefined, [query.data]);
  const loadMore = () => { if (!query.isFetching) void query.fetchNextPage({ cancelRefetch: false }); };
  const sentinelRef = useLoadMoreOnIntersection(enabled && query.hasNextPage && !query.isFetching && !query.error, loadMore);
  return { ...query, data, sentinelRef, loadMore };
};
