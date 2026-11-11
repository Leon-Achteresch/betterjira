import { Effect, Schema } from "effect";
import { jira } from "./client";

const RenderedIssueResponse = Schema.Struct({
  renderedFields: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        description: Schema.optional(Schema.NullOr(Schema.String)),
        comment: Schema.optional(
          Schema.NullOr(
            Schema.Struct({
              comments: Schema.optional(Schema.Array(Schema.Struct({ id: Schema.String, body: Schema.optional(Schema.NullOr(Schema.String)) }))),
            }),
          ),
        ),
      }),
    ),
  ),
});

export type RenderedIssue = { description?: string; comments: Readonly<Record<string, string>> };
export type RenderedDoc = { status: "loading" } | { status: "error" } | { status: "ready"; html: string };
export type RenderedSource = { status: "off" } | { status: "loading" } | { status: "error" } | { status: "ready"; issue: RenderedIssue };

export const renderedIssuePath = (key: string) =>
  `/issue/${encodeURIComponent(key)}?fields=description,comment&expand=renderedFields`;

export const toRenderedIssue = (response: typeof RenderedIssueResponse.Type): RenderedIssue => ({
  description: response.renderedFields?.description ?? undefined,
  comments: Object.fromEntries(
    (response.renderedFields?.comment?.comments ?? []).flatMap((entry) => (entry.body ? [[entry.id, entry.body] as const] : [])),
  ),
});

export const fetchRenderedIssue = (key: string) =>
  jira(renderedIssuePath(key), RenderedIssueResponse).pipe(Effect.map(toRenderedIssue));

export const renderedDescription = (source: RenderedSource): RenderedDoc | undefined => {
  if (source.status === "off") return undefined;
  if (source.status === "ready") return { status: "ready", html: source.issue.description ?? "" };
  return { status: source.status };
};

export const renderedComment = (
  source: RenderedSource | undefined,
  id: string,
  renderedBody: string | null | undefined,
): RenderedDoc | undefined => {
  if (typeof renderedBody === "string") return { status: "ready", html: renderedBody };
  if (!source || source.status === "off") return undefined;
  if (source.status === "ready") return { status: "ready", html: source.issue.comments[id] ?? "" };
  return { status: source.status };
};
