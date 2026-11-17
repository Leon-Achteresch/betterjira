import { Effect } from "effect";
import { shiftCalendarDate } from "../calendar-date-shift";
import { bulkEditIssue, bulkIssueEditMetadata } from "./bulk-edit";
import { JiraApiError, type JiraRequestScope } from "./client";
import { dueDateWriteStatus, maySetDueDate, readDueDateIssue, readDueDatePermissions, supportsDueDate } from "./due-date-fields";
import { isExactIssueKey } from "./issue-link";
import { readJiraAccount, type JiraQueryScope } from "./query-scope";
import { tableFieldApplyAllowed } from "@/lib/jira/table-field-apply-capability";
import { TABLE_FIELD_LIMITS, type TableFieldPreview, type TableFieldRow, type TableFieldTarget } from "./table-field-preview";

export type TableFieldApproval = {
  scope: JiraQueryScope;
  siteUrl: string;
  targets: readonly TableFieldTarget[];
  preview: TableFieldPreview;
};

export type TableFieldApplyResult = {
  row: TableFieldRow;
  status: "applied" | "blocked" | "uncertain" | "unchanged";
  message: string;
};

type CheckedRow = Extract<TableFieldRow, { identity: unknown }>;

const contextLost = "Konto oder Auswahl haben sich geändert. Diese Änderung wurde nicht gesendet.";
const blocked = (row: TableFieldRow, message: string): TableFieldApplyResult => ({ row, status: "blocked", message });

const confirmedTarget = (row: CheckedRow, approval: TableFieldApproval) => {
  const targets = approval.targets.filter(({ key, id }) => key === row.key || id === row.identity.id);
  return targets.length === 1 && targets[0]?.key === row.key && targets[0]?.id === row.identity.id
    && approval.preview.rows.filter(({ key }) => key === row.key).length === 1;
};

const recheck = (row: CheckedRow, scope: JiraRequestScope, account: JiraQueryScope, revoke: () => void) => Effect.gen(function* () {
  const currentAccount = yield* readJiraAccount(scope);
  if (currentAccount.accountId !== account.accountId) {
    revoke();
    return contextLost;
  }
  const rights = yield* readDueDatePermissions(row.key, scope);
  if (!maySetDueDate(rights)) return "Rechte zum Bearbeiten oder Planen fehlen.";
  const metadata = yield* bulkIssueEditMetadata(row.key, scope);
  if (!supportsDueDate(metadata)) return "Fälligkeit ist für dieses Ticket nicht mehr bearbeitbar.";
  const issue = yield* readDueDateIssue(row.key, scope);
  if (issue.key !== row.key || issue.id !== row.identity.id || issue.fields.project.id !== row.identity.projectId
    || issue.fields.issuetype.id !== row.identity.typeId || issue.fields.duedate !== row.before)
    return "Ticket oder Fälligkeit hat sich seit der Vorschau geändert. Bitte frisch prüfen.";
  return undefined;
}).pipe(Effect.catch(() => Effect.succeed(scope.isCurrent()
  ? "Ticket, Rechte oder Fälligkeit konnten nicht frisch geprüft werden."
  : contextLost)));

const applyRow = (row: TableFieldRow, approval: TableFieldApproval, scope: JiraRequestScope, revoke: () => void): Effect.Effect<TableFieldApplyResult> =>
  Effect.gen(function* () {
    if (row.status === "unchanged") return { row, status: "unchanged", message: "Bereits derselbe Wert." };
    if (row.status !== "change") return blocked(row, "Diese Zeile war in der Vorschau gesperrt.");
    if (!scope.isCurrent()) return blocked(row, contextLost);
    if (!isExactIssueKey(row.key) || !row.identity.id || shiftCalendarDate(row.value, 0) !== row.value
      || (row.before !== null && shiftCalendarDate(row.before, 0) !== row.before)
      || row.before === row.value || !confirmedTarget(row, approval))
      return blocked(row, "Die bestätigte Zuordnung oder Fälligkeit ist ungültig.");

    const rejected = yield* recheck(row, scope, approval.scope, revoke);
    if (rejected || !scope.isCurrent()) return blocked(row, rejected ?? contextLost);
    let dispatched = false;
    return yield* bulkEditIssue(row.identity.id, { kind: "due-date", value: row.value }, {
      ...scope,
      onDispatch: () => { dispatched = true; scope.onDispatch?.(); },
    }).pipe(
      Effect.as<TableFieldApplyResult>({ row, status: "applied", message: "Jira hat die Änderung bestätigt." }),
      Effect.catch((error) => {
        const status = dueDateWriteStatus(error);
        if (status === "skipped") return Effect.succeed(blocked(row, contextLost));
        if (status === "failed" && error instanceof JiraApiError)
          return Effect.succeed(blocked(row, `Jira hat die Änderung abgelehnt (HTTP ${error.status}).`));
        return Effect.succeed<TableFieldApplyResult>(dispatched
          ? { row, status: "uncertain", message: "Serverstand neu prüfen. Es gab keine automatische Wiederholung." }
          : blocked(row, "Der Schreibaufruf wurde vor dem Senden gesperrt."));
      }),
    );
  });

export const applyApprovedTableFields = (approval: TableFieldApproval, request: JiraRequestScope) => Effect.gen(function* () {
  if (request.cloudId !== approval.scope.cloudId || approval.preview.rows.length > TABLE_FIELD_LIMITS.rows
    || !tableFieldApplyAllowed(approval.scope, approval.siteUrl))
    return approval.preview.rows.map((row) => blocked(row, "Diese Ausführung ist gesperrt."));

  let revoked = false;
  const scope = {
    ...request,
    siteUrl: approval.siteUrl,
    isCurrent: () => !revoked && tableFieldApplyAllowed(approval.scope, approval.siteUrl) && request.isCurrent(),
  };
  const results: TableFieldApplyResult[] = [];
  let uncertain = false;
  for (const row of approval.preview.rows) {
    const result: TableFieldApplyResult = uncertain && row.status === "change"
      ? blocked(row, "Nach unklarem Ergebnis angehalten. Serverstand neu prüfen.")
      : yield* applyRow(row, approval, scope, () => { revoked = true; });
    results.push(result);
    uncertain ||= result.status === "uncertain";
  }
  return results;
});
