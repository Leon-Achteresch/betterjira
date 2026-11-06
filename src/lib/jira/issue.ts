import { Effect, Schema } from "effect";
import { jira, jiraImage, jiraSend } from "./client";

const issuePath = (key: string) => `/issue/${encodeURIComponent(key)}`;
const json = (method: string, body: unknown) => ({
  method,
  body: JSON.stringify(body),
});
const WikiFields = Schema.Struct({
  fields: Schema.Record(Schema.String, Schema.NullOr(Schema.Unknown)),
});

export const editIssue = (key: string, fields: Record<string, unknown>) =>
  jiraSend(issuePath(key), json("PUT", { fields }));
export const addWorklog = (
  key: string,
  worklog: { timeSpent: string; started: string; comment?: string },
) => jiraSend(`${issuePath(key)}/worklog`, json("POST", worklog), "api/2");

export const uploadAttachments = (key: string, files: File[]) => {
  const form = new FormData();
  for (const file of files) form.append("file", file);
  return jiraSend(`${issuePath(key)}/attachments`, {
    method: "POST",
    body: form,
    headers: { "X-Atlassian-Token": "no-check" },
  });
};

export const attachmentImage = (id: string, variant: "thumbnail" | "content") =>
  jiraImage(`/attachment/${variant}/${id}?redirect=false`);
export const editIssueWiki = (key: string, fields: Record<string, string>) =>
  jiraSend(issuePath(key), json("PUT", { fields }), "api/2");
export const wikiField = (key: string, field: string) =>
  jira(
    `${issuePath(key)}?fields=${encodeURIComponent(field)}`,
    WikiFields,
    undefined,
    "api/2",
  ).pipe(
    Effect.map(({ fields }) =>
      typeof fields[field] === "string" ? fields[field] : "",
    ),
  );
