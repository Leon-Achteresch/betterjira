import { useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import { useJiraMyself, useJiraSite } from "@/hooks/jira/use-jira";
import { useKeyedFocus } from "@/hooks/use-keyed-focus";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { focusKeyAfterRemoval } from "@/lib/focusable";
import {
  planningConfigQuery,
  planningSprintsQuery,
} from "@/lib/jira/board-planning-query";
import { type JiraBoard } from "@/lib/jira/board";
import {
  executePlanning,
  patchPlanning,
  planningJql,
  planningNeighbors,
  rollbackPlanning,
  type PlanningCommand,
} from "@/lib/jira/board-planning";
import { JiraApiError } from "@/lib/jira/client";
import { fieldText } from "@/lib/jira/field-text";
import { jiraKeys } from "@/lib/jira/keys";
import {
  jiraQueryScopeMatches,
  jiraRequestScope,
  withJiraQueryScope,
  type JiraQueryScope,
} from "@/lib/jira/query-scope";
import { searchIssues } from "@/lib/jira/search";

type PlanningJob = {
  command: PlanningCommand;
  scope: JiraQueryScope;
  queryKey: ReturnType<typeof jiraKeys.boardPlanning>;
};

const planningError = (error: unknown) =>
  error instanceof JiraApiError &&
  (error.status === 401 || error.status === 403)
    ? "Jira erlaubt diese Planung nicht. Nach dem Update erneut anmelden; zusätzlich werden Bearbeiten- und Planungsrechte im Projekt benötigt."
    : error instanceof Error
      ? error.message
      : "Die Planung konnte nicht gespeichert werden.";

export function useBoardPlanning(board: JiraBoard) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState({
    identity: "",
    source: "backlog",
  });
  const client = useQueryClient();
  const lock = useRef(false);
  const site = useJiraSite();
  const myself = useJiraMyself();
  const scope =
    site.data && myself.data
      ? { cloudId: site.data.cloudId, accountId: myself.data.accountId }
      : undefined;
  const identity = JSON.stringify([scope, board.id]);
  const source = selection.identity === identity ? selection.source : "backlog";
  const focusContext = `${identity}/${source}`;
  const latestFocusContext = useLatestRef(focusContext);
  const focusRequest = useRef<
    { context: string; key: string | undefined } | undefined
  >(undefined);
  const { refFor, fallbackRef, focus } = useKeyedFocus();
  if (selection.identity !== identity)
    setSelection({ identity, source: "backlog" });
  const config = useQuery({
    ...planningConfigQuery(client, board.id, scope),
    enabled: open && !!scope,
  });
  const sprintQuery = useQuery({
    ...planningSprintsQuery(client, board.id, scope),
    enabled: open && !!scope && board.type === "scrum",
  });
  const sprints = (sprintQuery.data ?? []).filter(
    ({ state }) => state === "active" || state === "future",
  );
  const jql = config.data
    ? planningJql(
        config.data.filter.id,
        source,
        config.data.ranking?.rankCustomFieldId,
      )
    : "";
  const queryKey = jiraKeys.boardPlanning(board.id, JSON.stringify(scope), jql);
  const pointsField = config.data?.estimation?.field?.fieldId;
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ signal, pageParam }) =>
      Effect.runPromise(
        withJiraQueryScope(
          client,
          scope,
          searchIssues(
            jql,
            [
              "summary",
              "status",
              "priority",
              ...(pointsField ? [pointsField] : []),
            ],
            pageParam,
          ),
        ),
        { signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page, _pages, token, tokens) => {
      const next = page.nextPageToken;
      return page.isLast || !next || next === token || tokens.includes(next)
        ? undefined
        : next;
    },
    enabled: open && !!scope && !!jql,
    staleTime: 30_000,
  });
  const mutation = useMutation({
    mutationFn: (job: PlanningJob) =>
      Effect.runPromise(
        withJiraQueryScope(
          client,
          job.scope,
          executePlanning(job.command, jiraRequestScope(client, job.scope)),
        ),
      ),
    onMutate: async (job) => {
      await client.cancelQueries({ queryKey: job.queryKey });
      if (!jiraQueryScopeMatches(client, job.scope)) return;
      const before = client.getQueryData<typeof query.data>(job.queryKey);
      client.setQueryData(job.queryKey, patchPlanning(before, job.command));
      return {
        before,
        optimistic: client.getQueryData<typeof query.data>(job.queryKey),
      };
    },
    onError: (error, job, context) => {
      rollbackPlanning(client, job.queryKey, context);
      if (!jiraQueryScopeMatches(client, job.scope)) return;
      toast.error(`${job.command.key}: Änderung fehlgeschlagen`, {
        description: planningError(error),
      });
    },
    onSuccess: (_result, job) => {
      if (!jiraQueryScopeMatches(client, job.scope)) return;
      toast.success(
        job.command.kind === "rank"
          ? "Reihenfolge gespeichert"
          : `${job.command.key} verschoben`,
      );
      void client.invalidateQueries({
        queryKey: jiraKeys.issue(job.command.key),
      });
    },
    onSettled: (_result, _error, job) => {
      lock.current = false;
      void client.invalidateQueries({
        queryKey: job.queryKey,
        refetchType: "none",
      });
      if (!jiraQueryScopeMatches(client, job.scope)) return;
      void client.invalidateQueries({ queryKey: jiraKeys.allBoards });
      void client.invalidateQueries({ queryKey: jiraKeys.allIssues });
    },
  });
  const issues = query.data?.pages.flatMap(({ issues }) => issues) ?? [];
  const pending = mutation.isPending;
  const busy = pending || config.isFetching || query.isFetching;
  const firstError =
    (!config.data ? config.error : null) ?? (!query.data ? query.error : null);
  const refreshError =
    (config.data ? config.error : null) ??
    (query.data && query.isRefetchError ? query.error : null);
  const send = (command: PlanningCommand) => {
    if (
      !scope ||
      lock.current ||
      busy ||
      !issues.some(({ key }) => key === command.key)
    )
      return;
    if (command.kind === "rank") {
      const neighbors = planningNeighbors(issues, command.key);
      const neighbor =
        command.direction === "before" ? neighbors.before : neighbors.after;
      if (neighbor?.id !== command.neighborId) return;
    }
    focusRequest.current = {
      context: focusContext,
      key:
        command.kind === "rank"
          ? command.key
          : focusKeyAfterRemoval(
              issues,
              issues.filter(({ key }) => key !== command.key),
              command.key,
            ),
    };
    lock.current = true;
    mutation.mutate({ command, scope, queryKey });
  };
  return {
    open,
    toggle: () => setOpen((value) => !value),
    source,
    rowRef: refFor,
    toggleRef: fallbackRef,
    restoreMenuFocus: (event: Event) => {
      const request = focusRequest.current;
      focusRequest.current = undefined;
      if (!request) return;
      event.preventDefault();
      requestAnimationFrame(() => {
        if (latestFocusContext.current === request.context) focus(request.key);
      });
    },
    setSource: (value: string) => {
      if (
        !pending &&
        (value === "backlog" || sprints.some(({ id }) => String(id) === value))
      )
        setSelection({ identity, source: value });
    },
    sprints,
    sprintError: sprintQuery.error
      ? planningError(sprintQuery.error)
      : undefined,
    sprintsLoading: sprintQuery.isFetching,
    retrySprints: () => void sprintQuery.refetch(),
    rows: issues.map((issue) => {
      const neighbors = planningNeighbors(issues, issue.key);
      return {
        key: issue.key,
        summary: fieldText(issue.fields.summary),
        status: fieldText(issue.fields.status),
        before: neighbors.before?.id,
        after: neighbors.after?.id,
      };
    }),
    total: issues.length,
    points: pointsField
      ? issues.reduce(
          (sum, issue) =>
            sum +
            (typeof issue.fields[pointsField] === "number"
              ? issue.fields[pointsField]
              : 0),
          0,
        )
      : undefined,
    pending,
    busy,
    refreshing:
      config.isFetching || (query.isFetching && !query.isFetchingNextPage),
    loadingMore: query.isFetchingNextPage,
    loading:
      !firstError && !query.data && (config.isPending || query.isPending),
    error: firstError ? planningError(firstError) : undefined,
    refreshError: refreshError ? planningError(refreshError) : undefined,
    loadMoreError: query.isFetchNextPageError
      ? planningError(query.error)
      : undefined,
    hasMore: query.hasNextPage,
    loadMore: () => {
      if (!pending && !query.isFetching) void query.fetchNextPage();
    },
    retry: () => void (config.error ? config.refetch() : query.refetch()),
    refresh: () => {
      if (!busy)
        void Promise.all([
          config.refetch(),
          sprintQuery.refetch(),
          query.refetch(),
        ]);
    },
    rank: (key: string, neighborId: string, direction: "before" | "after") =>
      send({
        kind: "rank",
        key,
        neighborId,
        direction,
        rankFieldId: config.data?.ranking?.rankCustomFieldId,
      }),
    move: (key: string, target: string) => {
      if (target === source) return;
      if (target === "backlog") send({ kind: "backlog", key });
      else if (sprints.some(({ id }) => String(id) === target))
        send({ kind: "sprint", key, sprintId: Number(target) });
    },
  };
}

export type BoardPlanningState = ReturnType<typeof useBoardPlanning>;
