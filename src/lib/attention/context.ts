import { Effect, Schema } from "effect";
import { jira } from "@/lib/jira/client";
import { adfToText, isAdfDoc } from "@/lib/jira/adf";

const JQL =
  "(assignee = currentUser() OR reporter = currentUser() OR watcher = currentUser()) AND statusCategory != Done ORDER BY updated DESC";
const FIELDS = "summary,issuetype,project,status,priority,duedate,created,updated,assignee,reporter,description,comment";
const MAX_ISSUES = 50;
const DESCRIPTION_CHARS = 800;
const COMMENT_CHARS = 500;
const RECENT_COMMENTS = 4;

const Person = Schema.Struct({ accountId: Schema.optional(Schema.String), displayName: Schema.String });

const ContextPage = Schema.Struct({
  issues: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      fields: Schema.Struct({
        summary: Schema.String,
        created: Schema.String,
        updated: Schema.String,
        duedate: Schema.optional(Schema.NullOr(Schema.String)),
        issuetype: Schema.optional(Schema.Struct({ name: Schema.String })),
        project: Schema.Struct({ key: Schema.String, name: Schema.String }),
        status: Schema.Struct({ name: Schema.String, statusCategory: Schema.Struct({ key: Schema.String }) }),
        priority: Schema.optional(Schema.NullOr(Schema.Struct({ name: Schema.String }))),
        assignee: Schema.optional(Schema.NullOr(Person)),
        reporter: Schema.optional(Schema.NullOr(Person)),
        description: Schema.optional(Schema.NullOr(Schema.Unknown)),
        comment: Schema.optional(
          Schema.Struct({
            total: Schema.Number,
            comments: Schema.Array(Schema.Struct({ author: Schema.optional(Person), created: Schema.String, body: Schema.Unknown })),
          }),
        ),
      }),
    }),
  ),
});
type ContextIssue = (typeof ContextPage.Type)["issues"][number];

export type AttentionContextInput = {
  runId: string;
  siteUrl: string;
  me: { accountId: string; displayName: string };
};

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

const plainText = (value: unknown, max: number) => clip((isAdfDoc(value) ? adfToText(value) : typeof value === "string" ? value : "").trim(), max);

const relation = (issue: ContextIssue, accountId: string) =>
  issue.fields.assignee?.accountId === accountId ? "assignee" : issue.fields.reporter?.accountId === accountId ? "reporter" : "watcher";

export const toContextIssue = (issue: ContextIssue, { siteUrl, me }: AttentionContextInput) => {
  const { fields } = issue;
  const comments = fields.comment?.comments ?? [];
  return {
    key: issue.key,
    url: `${siteUrl}/browse/${issue.key}`,
    title: fields.summary,
    type: fields.issuetype?.name ?? null,
    project: fields.project.name,
    status: fields.status.name,
    statusCategory: fields.status.statusCategory.key,
    priority: fields.priority?.name ?? null,
    due: fields.duedate ?? null,
    created: fields.created,
    updated: fields.updated,
    assignee: fields.assignee?.displayName ?? null,
    reporter: fields.reporter?.displayName ?? null,
    myRelation: relation(issue, me.accountId),
    description: plainText(fields.description, DESCRIPTION_CHARS),
    commentsTotal: fields.comment?.total ?? comments.length,
    recentComments: comments.slice(-RECENT_COMMENTS).map((comment) => ({
      author: comment.author?.displayName ?? "Unbekannt",
      byMe: comment.author?.accountId === me.accountId,
      created: comment.created,
      text: plainText(comment.body, COMMENT_CHARS),
    })),
  };
};

export const attentionContext = (input: AttentionContextInput) =>
  jira(`/search/jql?${new URLSearchParams({ jql: JQL, fields: FIELDS, maxResults: String(MAX_ISSUES) })}`, ContextPage).pipe(
    Effect.map((page) => ({
      requestedAt: new Date().toISOString(),
      me: input.me,
      issues: page.issues.map((issue) => toContextIssue(issue, input)),
    })),
  );
