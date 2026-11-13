import { Schema } from "effect";
import type { SearchIssue } from "./search";

export const ISSUE_GROUPINGS = {
  none: "Keine Gruppierung",
  status: "Status",
  assignee: "Bearbeiter",
  priority: "Priorität",
} as const;

export const IssueGrouping = Schema.Literals(["none", "status", "assignee", "priority"]);
export type IssueGrouping = typeof IssueGrouping.Type;

const GroupValue = Schema.Struct({
  id: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  accountId: Schema.optional(Schema.String),
  displayName: Schema.optional(Schema.String),
});
const isGroupValue = Schema.is(GroupValue);

export type IssueGroup = {
  id: string;
  label: string;
  empty: boolean;
  issues: SearchIssue[];
};

export type IssueGridEntry =
  | { kind: "group"; id: string; label: string; count: number; collapsed: boolean }
  | { kind: "issue"; id: string; issue: SearchIssue };

export function groupIssues(issues: readonly SearchIssue[], groupBy: IssueGrouping): IssueGroup[] {
  if (groupBy === "none") return [];
  const groups = new Map<string, IssueGroup>();
  for (const issue of issues) {
    const value = issue.fields[groupBy];
    const field = isGroupValue(value) ? value : undefined;
    const identity = groupBy === "assignee" ? field?.accountId : field?.id ?? field?.name;
    const empty = !identity;
    const label = groupBy === "assignee"
      ? field?.displayName || (identity ? "Unbekannter Bearbeiter" : "Nicht zugewiesen")
      : field?.name || (identity ? "Unbekannt" : "Ohne Wert");
    const id = JSON.stringify([groupBy, identity ?? null]);
    const group = groups.get(id);
    if (group) group.issues.push(issue);
    else groups.set(id, { id, label, empty, issues: [issue] });
  }
  return [...groups.values()].sort((a, b) => Number(a.empty) - Number(b.empty) || a.label.localeCompare(b.label, "de") || a.id.localeCompare(b.id));
}

export function issueGridEntries(
  issues: readonly SearchIssue[],
  groups: readonly IssueGroup[],
  groupBy: IssueGrouping,
  collapsed: readonly string[],
): IssueGridEntry[] {
  const issueEntry = (issue: SearchIssue): IssueGridEntry => ({ kind: "issue", id: `issue:${issue.id}`, issue });
  if (groupBy === "none") return issues.map(issueEntry);
  const hidden = new Set(collapsed);
  return groups.flatMap((group) => [
    { kind: "group", id: group.id, label: group.label, count: group.issues.length, collapsed: hidden.has(group.id) } satisfies IssueGridEntry,
    ...hidden.has(group.id) ? [] : group.issues.map(issueEntry),
  ]);
}
