import { Effect, Result } from "effect";
import { shiftCalendarDate } from "../calendar-date-shift";
import { parseTsv } from "../tsv";
import { bulkIssueEditMetadata } from "./bulk-edit";
import { JiraApiError, type JiraRequestScope } from "./client";
import { maySetDueDate, readDueDateIssue, readDueDatePermissions, supportsDueDate } from "./due-date-fields";
import { isExactIssueKey } from "./issue-link";

export const TABLE_FIELD_LIMITS = { characters: 12_000, rows: 20 } as const;
export const TABLE_PREVIEW_FIELD = "duedate";

export type TableFieldTarget = { key: string; id: string };
type Row = { line: number; key: string; value: string };
type ReadyRow = Row & { status: "unchecked"; id: string };
export type TableFieldRow = Row & {
  status: "change" | "unchanged" | "columns" | "missing-key" | "invalid-key" | "duplicate" | "outside-selection"
    | "ambiguous" | "missing-value" | "invalid-date" | "different-issue" | "missing-issue" | "forbidden"
    | "unsupported" | "missing-current" | "invalid-current" | "read-error";
  before?: string | null;
};
type TableFieldPlan = { rows: readonly (ReadyRow | TableFieldRow)[]; unmatched: number };

export function planTableFieldPreview(input: string, targets: readonly TableFieldTarget[]): TableFieldPlan | { error: string } {
  const parsed = parseTsv(input, TABLE_FIELD_LIMITS);
  if ("error" in parsed) return parsed;

  const selected = new Map<string, string | null>();
  for (const { key, id } of targets) {
    selected.set(key, selected.has(key) && selected.get(key) !== id ? null : id);
  }
  const counts = new Map<string, number>();
  for (const [key = ""] of parsed.rows) counts.set(key, (counts.get(key) ?? 0) + 1);

  const rows = parsed.rows.map((cells, index): ReadyRow | TableFieldRow => {
    const [key = "", value = ""] = cells;
    const row: Row = { line: index + 1, key, value };
    if (!key.trim()) return { ...row, status: "missing-key" };
    if (key.length > 255 || !isExactIssueKey(key)) return { ...row, status: "invalid-key" };
    if ((counts.get(key) ?? 0) > 1) return { ...row, status: "duplicate" };
    if (cells.length > 2) return { ...row, status: "columns" };
    const id = selected.get(key);
    if (id === undefined) return { ...row, status: "outside-selection" };
    if (id === null || id === "") return { ...row, status: "ambiguous" };
    if (!value.trim()) return { ...row, status: "missing-value" };
    if (shiftCalendarDate(value, 0) !== value) return { ...row, status: "invalid-date" };
    return { ...row, status: "unchecked", id };
  });
  return { rows, unmatched: [...selected.keys()].filter((key) => !counts.has(key)).length };
}

const failedRead = (error: unknown, issueLookup = false): TableFieldRow["status"] => {
  if (issueLookup && error instanceof JiraApiError && error.status === 404) return "missing-issue";
  if (error instanceof JiraApiError && error.status === 403) return "forbidden";
  return "read-error";
};

const readRow = ({ id, status: _status, ...row }: ReadyRow, scope: JiraRequestScope): Effect.Effect<TableFieldRow> =>
  Effect.gen(function* () {
    const lookup = yield* Effect.result(readDueDateIssue(row.key, scope));
    if (Result.isFailure(lookup)) return { ...row, status: failedRead(lookup.failure, true) };
    const issue = lookup.success;
    if (issue.key !== row.key || issue.id !== id) return { ...row, status: "different-issue" } satisfies TableFieldRow;
    const before = issue.fields.duedate;
    if (before === undefined) return { ...row, status: "missing-current" } satisfies TableFieldRow;
    if (before !== null && shiftCalendarDate(before, 0) !== before)
      return { ...row, status: "invalid-current" } satisfies TableFieldRow;
    return yield* Effect.gen(function* () {
      const rights = yield* readDueDatePermissions(row.key, scope);
      if (!maySetDueDate(rights)) return { ...row, before, status: "forbidden" } satisfies TableFieldRow;
      const metadata = yield* bulkIssueEditMetadata(row.key, scope);
      if (!supportsDueDate(metadata)) return { ...row, before, status: "unsupported" } satisfies TableFieldRow;
      return { ...row, before, status: before === row.value ? "unchanged" : "change" } satisfies TableFieldRow;
    }).pipe(Effect.catch((error) => Effect.succeed({ ...row, before, status: failedRead(error) })));
  });

export const previewTableField = (plan: TableFieldPlan, scope: JiraRequestScope) =>
  Effect.forEach(plan.rows, (row) => row.status === "unchecked" ? readRow(row, scope) : Effect.succeed(row), { concurrency: 2 })
    .pipe(Effect.map((rows) => ({ rows, unmatched: plan.unmatched })));
