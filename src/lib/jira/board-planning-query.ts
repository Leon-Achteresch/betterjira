import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { BoardConfiguration, boardSprints } from "./board";
import { jiraAgile } from "./client";
import { jiraKeys } from "./keys";
import { withJiraQueryScope, type JiraQueryScope } from "./query-scope";

export const planningConfigQuery = (client: QueryClient, boardId: number, scope: JiraQueryScope | undefined) => queryOptions({
  queryKey: jiraKeys.boardPlanningConfig(boardId, JSON.stringify(scope)),
  queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope, jiraAgile(`/board/${boardId}/configuration`, BoardConfiguration)), { signal }),
  staleTime: 60_000,
});

export const planningSprintsQuery = (client: QueryClient, boardId: number, scope: JiraQueryScope | undefined) => queryOptions({
  queryKey: jiraKeys.boardPlanningSprints(boardId, JSON.stringify(scope)),
  queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope, boardSprints(boardId)), { signal }),
  staleTime: 30_000,
});
