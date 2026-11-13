import { Schema } from "effect";
import { jira } from "./client";
import { jiraKeys } from "./keys";

const CreationParent = Schema.Struct({
  key: Schema.String,
  fields: Schema.Struct({
    summary: Schema.String,
    project: Schema.Struct({ id: Schema.String, key: Schema.String, name: Schema.String }),
    issuetype: Schema.Struct({ subtask: Schema.optional(Schema.Boolean) }),
  }),
});

export const creationParentKey = (scope: string, key: string) => [...jiraKeys.issue(key), "creation-parent", scope] as const;
export const fetchCreationParent = (key: string) => jira(`/issue/${encodeURIComponent(key)}?fields=summary,project,issuetype`, CreationParent);

export const createRouteSearch = (raw: Record<string, unknown>): { parent?: string } => {
  const parent = typeof raw.parent === "string" ? raw.parent.trim().toUpperCase() : "";
  return /^[A-Z][A-Z0-9_]*-\d+$/.test(parent) ? { parent } : {};
};
