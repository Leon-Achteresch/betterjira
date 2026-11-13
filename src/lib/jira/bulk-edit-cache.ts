import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import type { BulkAction } from "./bulk-edit";
import { jiraKeys } from "./keys";
import type { SearchIssue, SearchPage } from "./search";

type Patch = {
  queryKey: QueryKey;
  key: string;
  field: string;
  before: unknown;
  after: unknown;
};

export function optimisticBulkFields(
  issue: SearchIssue,
  action: Exclude<BulkAction, { kind: "status" }>,
  displayValue: unknown,
) {
  if (action.kind === "assignee")
    return { field: "assignee", value: displayValue };
  if (action.kind === "priority")
    return { field: "priority", value: displayValue };
  const labels = Array.isArray(issue.fields.labels)
    ? issue.fields.labels.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  return {
    field: "labels",
    value:
      action.kind === "add-labels"
        ? [...new Set([...labels, ...action.labels])]
        : labels.filter((label) => !action.labels.includes(label)),
  };
}

export function patchBulkSearches(
  client: QueryClient,
  keys: readonly string[],
  action: BulkAction,
  displayValue: unknown,
): Patch[] {
  if (action.kind === "status") return [];
  const selected = new Set(keys);
  const patches: Patch[] = [];
  for (const [queryKey, data] of client.getQueriesData<
    InfiniteData<SearchPage>
  >({ queryKey: jiraKeys.allIssues })) {
    if (queryKey[2] !== "search" || !data?.pages) continue;
    const before = new Map<string, { field: string; value: unknown }>();
    const stored = client.setQueryData<InfiniteData<SearchPage>>(queryKey, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        issues: page.issues.map((issue) => {
          if (!selected.has(issue.key)) return issue;
          const change = optimisticBulkFields(issue, action, displayValue);
          before.set(issue.key, {
            field: change.field,
            value: issue.fields[change.field],
          });
          return {
            ...issue,
            fields: { ...issue.fields, [change.field]: change.value },
          };
        }),
      })),
    });
    for (const page of stored?.pages ?? [])
      for (const issue of page.issues) {
        const previous = before.get(issue.key);
        if (previous)
          patches.push({
            queryKey,
            key: issue.key,
            field: previous.field,
            before: previous.value,
            after: issue.fields[previous.field],
          });
      }
  }
  return patches;
}

export function rollbackBulkSearches(
  client: QueryClient,
  patches: readonly Patch[],
  keys?: readonly string[],
) {
  for (const patch of patches) {
    if (keys && !keys.includes(patch.key)) continue;
    client.setQueryData<InfiniteData<SearchPage>>(
      patch.queryKey,
      (data) =>
        data && {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            issues: page.issues.map((issue) =>
              issue.key === patch.key &&
              issue.fields[patch.field] === patch.after
                ? {
                    ...issue,
                    fields: { ...issue.fields, [patch.field]: patch.before },
                  }
                : issue,
            ),
          })),
        },
    );
  }
}
