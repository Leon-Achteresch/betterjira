import { Data, Effect, Schema } from "effect";
import { jira, jiraSend, JiraApiError, JiraRequestScopeChanged, NotAuthenticated, type JiraRequestScope } from "./client";

export const AttachmentSnapshot = Schema.Struct({
  id: Schema.String, filename: Schema.String, size: Schema.Number, mimeType: Schema.String, created: Schema.String,
  author: Schema.optional(Schema.Struct({ accountId: Schema.optional(Schema.String) })),
});
export type AttachmentSnapshot = typeof AttachmentSnapshot.Type;
const AttachmentIssue = Schema.Struct({ key: Schema.String, fields: Schema.Struct({ attachment: Schema.Array(AttachmentSnapshot) }) });
const AttachmentPermissions = Schema.Struct({ permissions: Schema.Record(Schema.String, Schema.Struct({ havePermission: Schema.Boolean })) });
export type AttachmentDeletePermissions = { own: boolean; all: boolean };
export type AttachmentDeleteResult = { attachment: AttachmentSnapshot; status: "deleted" | "failed" | "uncertain" | "not-attempted"; message: string };

export class AttachmentContextChanged extends Data.TaggedError("AttachmentContextChanged")<{}> {
  override get message() { return "Ticket, Konto oder Auswahlkontext hat sich geändert. Bitte die Anhänge erneut prüfen."; }
}

export const attachmentManagement = (issueKey: string, scope: JiraRequestScope) => Effect.all({
  issue: jira(`/issue/${encodeURIComponent(issueKey)}?fields=attachment`, AttachmentIssue, { scope, cache: "no-store" }),
  permissions: jira(`/mypermissions?${new URLSearchParams({ issueKey, permissions: "DELETE_OWN_ATTACHMENTS,DELETE_ALL_ATTACHMENTS" })}`, AttachmentPermissions, { scope, cache: "no-store" }),
}, { concurrency: 2 }).pipe(Effect.map(({ issue, permissions }) => ({
  issueKey: issue.key,
  attachments: issue.fields.attachment,
  permissions: { own: permissions.permissions.DELETE_OWN_ATTACHMENTS?.havePermission === true, all: permissions.permissions.DELETE_ALL_ATTACHMENTS?.havePermission === true },
})));

export const canDeleteAttachment = (attachment: AttachmentSnapshot, permissions: AttachmentDeletePermissions | undefined, accountId: string | undefined) =>
  !!permissions && (permissions.all || (permissions.own && !!accountId && attachment.author?.accountId === accountId));

export const sameAttachment = (a: AttachmentSnapshot, b: AttachmentSnapshot) => a.id === b.id && a.filename === b.filename
  && a.size === b.size && a.mimeType === b.mimeType && a.created === b.created && a.author?.accountId === b.author?.accountId;

const failure = (attachment: AttachmentSnapshot, error: unknown): AttachmentDeleteResult => {
  if (error instanceof JiraRequestScopeChanged || error instanceof AttachmentContextChanged || error instanceof NotAuthenticated)
    return { attachment, status: "not-attempted", message: "Kontext oder Anmeldung geändert. Nicht erneut gesendet; bitte den Serverstand prüfen." };
  if (error instanceof JiraApiError && error.status < 500 && error.status !== 408)
    return { attachment, status: "failed", message: `Jira hat die Löschung abgelehnt (HTTP ${error.status}). Vor einem neuen Versuch erneut prüfen.` };
  return { attachment, status: "uncertain", message: "Ergebnis unklar. Nicht automatisch erneut löschen; zuerst den Serverstand neu prüfen." };
};

export const deleteAttachmentSelection = (issueKey: string, selected: readonly AttachmentSnapshot[], accountId: string, scope: JiraRequestScope,
  onResult: (result: AttachmentDeleteResult) => void = () => undefined,
) => Effect.gen(function* () {
  if (!scope.isCurrent()) return yield* new AttachmentContextChanged();
  const unique = [...new Map(selected.map((attachment) => [attachment.id, attachment])).values()];
  if (!unique.length) return [];
  const preflight = yield* attachmentManagement(issueKey, scope).pipe(
    Effect.map((data) => ({ data })),
    Effect.catch(() => Effect.succeed({ data: null })),
  );
  if (!preflight.data) {
    const results = unique.map((attachment): AttachmentDeleteResult => ({ attachment, status: "not-attempted", message: "Anhänge oder Löschrechte konnten nicht frisch geprüft werden. Keine Löschung gesendet." }));
    yield* Effect.sync(() => results.forEach(onResult));
    return results;
  }
  const fresh = preflight.data;
  if (fresh.issueKey.toUpperCase() !== issueKey.toUpperCase()) return yield* new AttachmentContextChanged();
  const results: AttachmentDeleteResult[] = [];
  for (const attachment of unique) {
    const current = fresh.attachments.find((entry) => entry.id === attachment.id);
    const result: AttachmentDeleteResult = !scope.isCurrent()
      ? { attachment, status: "not-attempted", message: "Gestoppt oder Kontext gewechselt. Diese Datei wurde nicht gesendet." }
      : !current
        ? { attachment, status: "not-attempted", message: "Im frisch gelesenen Ticket nicht vorhanden. Keine Löschung gesendet." }
        : !sameAttachment(current, attachment)
          ? { attachment, status: "not-attempted", message: "Dateiangaben haben sich geändert. Bitte erneut auswählen und bestätigen." }
          : !canDeleteAttachment(current, fresh.permissions, accountId)
            ? { attachment, status: "failed", message: "Keine Berechtigung zum Entfernen dieser Datei. Keine Löschung gesendet." }
            : yield* jiraSend(`/attachment/${encodeURIComponent(attachment.id)}`, { method: "DELETE", scope, retry: false }).pipe(
                Effect.map((): AttachmentDeleteResult => ({ attachment, status: "deleted", message: "Von Jira als gelöscht bestätigt." })),
                Effect.catch((error) => Effect.succeed(failure(attachment, error))),
              );
    results.push(result);
    yield* Effect.sync(() => onResult(result));
  }
  return results;
});
