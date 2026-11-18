import { Data, Effect, Schema } from "effect";
import { jira, jiraImage, JiraApiError, jiraRedirectLocation, JiraRequestScopeChanged, jiraSend, type JiraRequestScope } from "./client";
import { normalizeRemainingEstimate, worklogEstimateQuery, type WorklogBooking } from "./worklog";
import { mediaIdFromLocation } from "./adf-media";
import { worklogEstimateAllowed } from "@/lib/jira/worklog-estimate-capability";
import { readJiraAccount } from "./query-scope";

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
const AddedWorklog = Schema.Struct({ id: Schema.NonEmptyString, issueId: Schema.String });
class WorklogBookingUnconfirmed extends Data.TaggedError("WorklogBookingUnconfirmed")<{}> {}

export const addWorklog = (key: string, worklog: WorklogBooking) =>
  Effect.gen(function* () {
    const { remainingEstimate, ...body } = worklog;
    if (!remainingEstimate) return yield* jiraSend(`${issuePath(key)}/worklog`, json("POST", body), "api/2");

    const { issueId, scope, value } = remainingEstimate;
    if (!normalizeRemainingEstimate(value) || !/^\d+$/.test(issueId))
      return yield* new JiraApiError({ status: 400, body: "Restschätzung oder Ticket nicht gültig." });
    if (!worklogEstimateAllowed(scope, scope.siteUrl) || !scope.isCurrent())
      return yield* new JiraRequestScopeChanged();
    const { onDispatch, ...readScope } = scope;
    const account = yield* readJiraAccount(readScope, false);
    if (account.accountId !== scope.accountId || !scope.isCurrent())
      return yield* new JiraRequestScopeChanged();

    const path = `${issuePath(issueId)}/worklog${worklogEstimateQuery(value)}`;
    const added = yield* jira(path, AddedWorklog, {
      ...json("POST", body), scope: { ...readScope, onDispatch }, retry: false, maxRedirections: 0,
    }, "api/2");
    if (added.issueId !== issueId) return yield* new WorklogBookingUnconfirmed();
  });

const UploadedAttachments = Schema.Array(
  Schema.Struct({
    id: Schema.Union([Schema.String, Schema.Number]),
    filename: Schema.String,
    size: Schema.Number,
    mimeType: Schema.String,
    created: Schema.String,
  }),
);

export const uploadAttachments = (key: string, files: File[], scope?: JiraRequestScope) => {
  const form = new FormData();
  for (const file of files) form.append("file", file, file.name);
  return jira(`${issuePath(key)}/attachments`, UploadedAttachments, {
    method: "POST",
    body: form,
    headers: { "X-Atlassian-Token": "no-check" },
    ...(scope && { scope, retry: false }),
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

export const uploadFile = (key: string, file: File, scope?: JiraRequestScope) =>
  uploadAttachments(key, [file], scope).pipe(
    Effect.flatMap(([attachment]) =>
      attachment ? Effect.succeed(attachment) : Effect.fail(new JiraApiError({ status: 502, body: "Jira hat den Anhang nicht bestätigt" })),
    ),
  );

export const optionalAttachmentMediaId = (id: string) => attachmentMediaId(id).pipe(Effect.orElseSucceed(() => undefined));

export const attachmentImage = (id: string, variant: "thumbnail" | "content") =>
  jiraImage(`/attachment/${variant}/${id}?redirect=false`);
export const editIssueWiki = (key: string, fields: Record<string, string>) =>
  jiraSend(issuePath(key), json("PUT", { fields }), "api/2");
export const wikiField = (key: string, field: string, scope?: JiraRequestScope) =>
  jira(
    `${issuePath(key)}?fields=${encodeURIComponent(field)}`,
    WikiFields,
    { scope, cache: "no-store" },
    "api/2",
  ).pipe(
    Effect.flatMap(({ fields }) => {
      const raw = fields[field];
      return raw === null || typeof raw === "string"
        ? Effect.succeed({ text: raw ?? "", raw })
        : Effect.fail(new JiraApiError({ status: 502, body: "Das Wiki-Feld fehlt oder lässt sich nicht originalgetreu lesen." }));
    }),
  );
