import { Data, Effect, Schema } from "effect";
import { jira, type JiraRequestScope } from "./client";

const MAX_PAGES = 20;
const PAGE_SIZE = 100;

export const CreateIssueType = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  subtask: Schema.optional(Schema.Boolean),
  iconUrl: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
});

export type CreateIssueType = typeof CreateIssueType.Type;

const Page = {
  startAt: Schema.optional(Schema.Number),
  maxResults: Schema.optional(Schema.Number),
  total: Schema.optional(Schema.Number),
};

const IssueTypePage = Schema.Struct({
  ...Page,
  issueTypes: Schema.optional(Schema.Array(CreateIssueType)),
  createMetaIssueType: Schema.optional(Schema.Array(CreateIssueType)),
});

export const CreateField = Schema.Struct({
  fieldId: Schema.String,
  name: Schema.String,
  required: Schema.Boolean,
  schema: Schema.Struct({
    type: Schema.String,
    items: Schema.optional(Schema.String),
    system: Schema.optional(Schema.String),
    custom: Schema.optional(Schema.String),
  }),
  allowedValues: Schema.optional(Schema.Array(Schema.Unknown)),
  hasDefaultValue: Schema.optional(Schema.Boolean),
  operations: Schema.optional(Schema.Array(Schema.String)),
});

export type CreateField = typeof CreateField.Type;

const FieldPage = Schema.Struct({
  ...Page,
  fields: Schema.optional(Schema.Array(CreateField)),
  results: Schema.optional(Schema.Array(CreateField)),
});

const Permissions = Schema.Struct({
  permissions: Schema.Record(Schema.String, Schema.Struct({ havePermission: Schema.Boolean })),
});

export const CreatedIssue = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  self: Schema.String,
});

export type CreatedIssue = typeof CreatedIssue.Type;

export type CreateIssuePayload = { fields: Record<string, unknown> };

const paged = <T>(load: (startAt: number) => Effect.Effect<{ items: readonly T[]; total?: number }, unknown>) =>
  Effect.gen(function* () {
    const all: T[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const { items, total } = yield* load(all.length);
      all.push(...items);
      if (items.length === 0 || all.length >= (total ?? all.length)) break;
    }
    return all;
  });

const metaPath = (projectId: string) => `/issue/createmeta/${encodeURIComponent(projectId)}/issuetypes`;
const pageQuery = (startAt: number) => `startAt=${startAt}&maxResults=${PAGE_SIZE}`;

export const createIssueTypes = (projectId: string) =>
  paged((startAt) =>
    jira(`${metaPath(projectId)}?${pageQuery(startAt)}`, IssueTypePage).pipe(
      Effect.map((page) => ({ items: page.issueTypes ?? page.createMetaIssueType ?? [], total: page.total })),
    ),
  );

export const createFields = (projectId: string, issueTypeId: string) =>
  paged((startAt) =>
    jira(`${metaPath(projectId)}/${encodeURIComponent(issueTypeId)}?${pageQuery(startAt)}`, FieldPage).pipe(
      Effect.map((page) => ({ items: page.fields ?? page.results ?? [], total: page.total })),
    ),
  );

export const canCreateIssues = (projectId: string) =>
  jira(`/mypermissions?${new URLSearchParams({ projectId, permissions: "CREATE_ISSUES" })}`, Permissions).pipe(
    Effect.map(({ permissions }) => permissions.CREATE_ISSUES?.havePermission === true),
  );

export class CreateIssueResponseError extends Data.TaggedError("CreateIssueResponseError")<{}> {}

export const createIssue = (payload: CreateIssuePayload, requestScope?: JiraRequestScope) =>
  jira("/issue", CreatedIssue, { method: "POST", body: JSON.stringify(payload), scope: requestScope }).pipe(
    Effect.catchTag("SchemaError", () => Effect.fail(new CreateIssueResponseError())),
  );
