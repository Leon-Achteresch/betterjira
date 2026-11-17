import { Schema } from "effect";
import { jira, JiraApiError, JiraRequestScopeChanged, NotAuthenticated, type JiraRequestScope } from "./client";
import type { BulkMetadata } from "./bulk-edit";

export const DueDateIssue = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  fields: Schema.Struct({
    duedate: Schema.optional(Schema.NullOr(Schema.String)),
    project: Schema.Struct({ id: Schema.String }),
    issuetype: Schema.Struct({ id: Schema.String }),
  }),
});

const DueDatePermissions = Schema.Struct({
  permissions: Schema.Record(Schema.String, Schema.Struct({ havePermission: Schema.Boolean })),
});

export const readDueDateIssue = (key: string, scope: JiraRequestScope) =>
  jira(`/issue/${encodeURIComponent(key)}?fields=duedate,project,issuetype`, DueDateIssue, { scope, cache: "no-store" });

export const readDueDatePermissions = (key: string, scope: JiraRequestScope) =>
  jira(`/mypermissions?${new URLSearchParams({ issueKey: key, permissions: "EDIT_ISSUES,SCHEDULE_ISSUES" })}`,
    DueDatePermissions, { scope, cache: "no-store" });

export const maySetDueDate = ({ permissions }: typeof DueDatePermissions.Type) =>
  permissions.EDIT_ISSUES?.havePermission && permissions.SCHEDULE_ISSUES?.havePermission;

export const supportsDueDate = (metadata: BulkMetadata) =>
  metadata.fields.duedate?.operations?.includes("set");

export const dueDateWriteStatus = (error: unknown) => {
  if (error instanceof JiraRequestScopeChanged || error instanceof NotAuthenticated) return "skipped";
  if (error instanceof JiraApiError && error.status < 500 && error.status !== 408) return "failed";
  return "uncertain";
};
