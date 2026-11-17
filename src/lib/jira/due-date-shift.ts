import { Data, Effect } from "effect";
import { JiraApiError, type JiraRequestScope } from "./client";
import { bulkEditIssue, bulkIssueEditMetadata } from "./bulk-edit";
import { shiftCalendarDate } from "../calendar-date-shift";
import { dueDateWriteStatus, maySetDueDate, readDueDateIssue, readDueDatePermissions, supportsDueDate } from "./due-date-fields";

export type DueDateShiftRow = { key: string; id?: string; projectId?: string; typeId?: string; before?: string | null; after: string | null; reason?: string };
export type DueDateShiftPreview = { days: number; rows: readonly DueDateShiftRow[] };
export type DueDateShiftResult = { row: DueDateShiftRow; status: "changed" | "skipped" | "failed" | "uncertain"; message: string };

export class DueDateShiftInvalid extends Data.TaggedError("DueDateShiftInvalid")<{}> {
  override get message() { return "Bitte eine ganze Anzahl Tage ungleich 0 wählen und die Vorschau neu prüfen."; }
}

const readRow = (key: string, days: number, scope: JiraRequestScope): Effect.Effect<DueDateShiftRow> => Effect.gen(function* () {
  if (!scope.isCurrent()) return { key, after: null, reason: "Kontext geändert. Keine Änderung gesendet." };
  const { issue, metadata, rights } = yield* Effect.all({
    issue: readDueDateIssue(key, scope),
    metadata: bulkIssueEditMetadata(key, scope),
    rights: readDueDatePermissions(key, scope),
  }, { concurrency: 3 });
  const before = issue.fields.duedate;
  const after = typeof before === "string" ? shiftCalendarDate(before, days) : null;
  const reason = issue.key.toUpperCase() !== key.toUpperCase() ? "Ticketzuordnung hat sich geändert."
    : !maySetDueDate(rights) ? "Bearbeiten oder Vorgänge planen ist nicht erlaubt."
    : !supportsDueDate(metadata) ? "Fälligkeit ist für dieses Ticket nicht bearbeitbar."
    : before === undefined ? "Fälligkeit wurde nicht geliefert."
    : before === null || before === "" ? "Keine vorhandene Fälligkeit."
    : shiftCalendarDate(before, 0) === null ? "Ungültiges Kalenderdatum."
    : after === null ? "Zieldatum liegt außerhalb des gültigen Bereichs 0001–9999." : undefined;
  return { key, id: issue.id, projectId: issue.fields.project.id, typeId: issue.fields.issuetype.id, before, after, reason };
}).pipe(Effect.catch(() => Effect.succeed<DueDateShiftRow>({ key, after: null, reason: "Datum, Metadaten oder Rechte konnten nicht frisch gelesen werden. Keine Änderung gesendet." })));

export const previewDueDateShift = (keys: readonly string[], days: number, scope: JiraRequestScope) => Effect.gen(function* () {
  if (!Number.isSafeInteger(days) || days === 0) return yield* new DueDateShiftInvalid();
  const rows = yield* Effect.forEach([...new Set(keys)], (key) => readRow(key, days, scope), { concurrency: 3 });
  return { days, rows };
});

const writeFailure = (row: DueDateShiftRow, error: unknown): DueDateShiftResult => {
  const status = dueDateWriteStatus(error);
  if (status === "skipped")
    return { row, status: "skipped", message: "Kontext oder Anmeldung geändert. Keine weitere Änderung gesendet; Serverstand neu prüfen." };
  if (status === "failed" && error instanceof JiraApiError)
    return { row, status: "failed", message: `Jira hat die Änderung abgelehnt (HTTP ${error.status}).` };
  return { row, status: "uncertain", message: "Ergebnis unklar. Nicht automatisch erneut verschieben; zuerst den Serverstand neu lesen und prüfen." };
};

export const applyDueDateShift = (preview: DueDateShiftPreview, scope: JiraRequestScope, onResult: (result: DueDateShiftResult) => void = () => undefined) => Effect.gen(function* () {
  if (!Number.isSafeInteger(preview.days) || preview.days === 0) return yield* new DueDateShiftInvalid();
  const results: DueDateShiftResult[] = [];
  for (const row of [...new Map(preview.rows.map((entry) => [entry.key, entry])).values()]) {
    let result: DueDateShiftResult;
    if (!scope.isCurrent()) result = { row, status: "skipped", message: "Gestoppt oder Auswahlkontext geändert. Keine Änderung gesendet." };
    else if (row.reason || !row.after || typeof row.before !== "string" || shiftCalendarDate(row.before, preview.days) !== row.after)
      result = { row, status: "skipped", message: row.reason ?? "Ungültige Vorschau. Bitte neu prüfen." };
    else {
      const fresh = yield* readRow(row.key, preview.days, scope);
      if (!scope.isCurrent()) result = { row, status: "skipped", message: "Gestoppt oder Auswahlkontext geändert. Keine Änderung gesendet." };
      else if (fresh.reason) result = { row, status: "skipped", message: fresh.reason };
      else if (fresh.id !== row.id || fresh.projectId !== row.projectId || fresh.typeId !== row.typeId || fresh.before !== row.before || fresh.after !== row.after)
        result = { row, status: "skipped", message: "Ticket oder Fälligkeit hat sich seit der Vorschau geändert. Bitte neu prüfen und bestätigen." };
      else result = yield* bulkEditIssue(row.key, { kind: "due-date", value: row.after }, scope).pipe(
        Effect.map((): DueDateShiftResult => ({ row, status: "changed", message: "Von Jira als geändert bestätigt." })),
        Effect.catch((error) => Effect.succeed(writeFailure(row, error))),
      );
    }
    results.push(result);
    yield* Effect.sync(() => onResult(result));
  }
  return results;
});
