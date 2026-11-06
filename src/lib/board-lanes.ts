export const EXPEDITE_PRIORITY = "Blocker";

type LaneIssue = { fields: { priority?: { name: string } | null } };

export type BoardLane<C> = { name?: string; columns: C[] };

const isExpedite = (issue: LaneIssue) => issue.fields.priority?.name === EXPEDITE_PRIORITY;

export const boardLanes = <I extends LaneIssue, C extends { issues: I[] }>(columns: C[]): BoardLane<C>[] => {
  if (!columns.some((column) => column.issues.some(isExpedite))) return [{ columns }];
  const lane = (name: string, keep: (issue: I) => boolean) => ({
    name,
    columns: columns.map((column) => ({ ...column, issues: column.issues.filter(keep) })),
  });
  return [lane("Beschleunigen", isExpedite), lane("Alles andere", (issue) => !isExpedite(issue))];
};
