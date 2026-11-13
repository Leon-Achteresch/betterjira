import { Data, Effect } from "effect";
import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import { jiraAgileWrite, type JiraRequestScope } from "./client";
import type { SearchIssue, SearchPage } from "./search";

export type PlanningCommand =
  | { kind: "rank"; key: string; neighborId: string; direction: "before" | "after"; rankFieldId?: number }
  | { kind: "sprint"; key: string; sprintId: number }
  | { kind: "backlog"; key: string };

export class PlanningInputError extends Data.TaggedError("PlanningInputError")<{ message: string }> {}

export const executePlanning = (command: PlanningCommand, requestScope?: JiraRequestScope) => Effect.gen(function* () {
  if (command.kind === "sprint" && (!Number.isSafeInteger(command.sprintId) || command.sprintId <= 0)) {
    return yield* new PlanningInputError({ message: "Ungültiger Sprint." });
  }
  if (command.kind === "rank" && (!command.neighborId || command.neighborId === command.key)) {
    return yield* new PlanningInputError({ message: "Für die Rangänderung fehlt ein benachbarter Vorgang." });
  }
  const path = command.kind === "rank" ? "/issue/rank" : command.kind === "sprint" ? `/sprint/${command.sprintId}/issue` : "/backlog/issue";
  const body = command.kind === "rank"
    ? { issues: [command.key], [command.direction === "before" ? "rankBeforeIssue" : "rankAfterIssue"]: command.neighborId, rankCustomFieldId: command.rankFieldId }
    : { issues: [command.key] };
  return yield* jiraAgileWrite(path, { method: command.kind === "rank" ? "PUT" : "POST", body: JSON.stringify(body), scope: requestScope }, command.key);
});

export function planningJql(filterId: string, source: string, rankFieldId?: number): string {
  const rank = rankFieldId === undefined ? "Rank" : `cf[${rankFieldId}]`;
  const sprint = source === "backlog"
    ? "(sprint is EMPTY OR sprint not in openSprints() AND sprint not in futureSprints()) AND statusCategory != Done"
    : `sprint = ${Number(source)}`;
  return `filter = ${filterId} AND ${sprint} ORDER BY ${rank} ASC`;
}

export function planningNeighbors(issues: readonly SearchIssue[], key: string) {
  const index = issues.findIndex((issue) => issue.key === key);
  return { before: index > 0 ? issues[index - 1] : undefined, after: index >= 0 ? issues[index + 1] : undefined };
}

export function patchPlanning(data: InfiniteData<SearchPage> | undefined, command: PlanningCommand): InfiniteData<SearchPage> | undefined {
  if (!data) return data;
  const all = data.pages.flatMap((page) => page.issues);
  const moving = all.find((issue) => issue.key === command.key);
  if (!moving) return data;
  const reordered = all.filter((issue) => issue.key !== command.key);
  if (command.kind === "rank") {
    const index = reordered.findIndex((issue) => issue.id === command.neighborId || issue.key === command.neighborId);
    if (index < 0) return data;
    reordered.splice(index + Number(command.direction === "after"), 0, moving);
  }
  let offset = 0;
  return { ...data, pages: data.pages.map((page) => {
    const issues = reordered.slice(offset, offset + page.issues.length);
    offset += page.issues.length;
    return { ...page, issues };
  }) };
}

export function rollbackPlanning(client: QueryClient, key: QueryKey, snapshot: {
  before: InfiniteData<SearchPage> | undefined;
  optimistic: InfiniteData<SearchPage> | undefined;
} | undefined) {
  if (snapshot?.before && client.getQueryData(key) === snapshot.optimistic) client.setQueryData(key, snapshot.before);
}
