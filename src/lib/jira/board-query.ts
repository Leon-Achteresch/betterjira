import { infiniteQueryOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { jiraAgile } from "./client";
import { BoardConfiguration, fetchBoardPage, type BoardIdentity } from "./board";
import { jiraKeys } from "./keys";
import { fieldCatalogQuery } from "./metadata-query";

export const boardConfigQuery = (id: number) => queryOptions({
  queryKey: jiraKeys.boardConfig(id),
  queryFn: ({ signal }) => Effect.runPromise(jiraAgile(`/board/${id}/configuration`, BoardConfiguration), { signal }),
  staleTime: 10 * 60_000,
  gcTime: 60 * 60_000,
});

export const boardQuery = (client: QueryClient, board: BoardIdentity, sprintId?: number) => infiniteQueryOptions({
  queryKey: jiraKeys.board(board.id, sprintId),
  initialPageParam: undefined as string | undefined,
  queryFn: async ({ signal, pageParam }) => {
    const [config, fields] = await Promise.all([
      client.fetchQuery(boardConfigQuery(board.id)),
      client.fetchQuery(fieldCatalogQuery()),
    ]);
    signal.throwIfAborted();
    return Effect.runPromise(fetchBoardPage(board, config, fields, sprintId, pageParam), { signal });
  },
  getNextPageParam: (page, _pages, token, tokens) => {
    const next = page.nextPageToken;
    return page.isLast || !next || next === token || tokens.includes(next) ? undefined : next;
  },
  staleTime: 60_000,
  gcTime: 30 * 60_000,
});
