import { Effect, Schema } from "effect";
import { jira, jiraImage, JiraApiError, jiraRedirectLocation, jiraSend } from "./client";
import { mediaIdFromLocation } from "./adf-media";

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

const UploadedAttachments = Schema.Array(
  Schema.Struct({
    id: Schema.Union([Schema.String, Schema.Number]),
    filename: Schema.String,
    size: Schema.Number,
    mimeType: Schema.String,
    created: Schema.String,
  }),
);

export const uploadAttachments = (key: string, files: File[]) => {
  const form = new FormData();
  for (const file of files) form.append("file", file, file.name);
  return jira(`${issuePath(key)}/attachments`, UploadedAttachments, {
    method: "POST",
    body: form,
    headers: { "X-Atlassian-Token": "no-check" },
  }).pipe(Effect.map((attachments) => attachments.map((attachment) => ({ ...attachment, id: String(attachment.id) }))));
};

export const attachmentMediaId = (id: string) =>
  jiraRedirectLocation(`/attachment/content/${encodeURIComponent(id)}`).pipe(
    Effect.flatMap((location) => {
      const mediaId = mediaIdFromLocation(location);
      return mediaId
        ? Effect.succeed(mediaId)
        : Effect.fail(new JiraApiError({ status: 502, body: "Jira hat für den Anhang keine Medien-Kennung geliefert" }));
    }),
  );

export const uploadEmbeddedFile = (key: string, file: File) =>
  Effect.gen(function* () {
    const [attachment] = yield* uploadAttachments(key, [file]);
    if (!attachment) return yield* new JiraApiError({ status: 502, body: "Jira hat den Anhang nicht bestätigt" });
    const mediaId = yield* attachmentMediaId(attachment.id);
    return { attachment, mediaId };
  });

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
