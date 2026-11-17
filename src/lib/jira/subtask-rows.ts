import { Data, Effect } from "effect";
import { JiraApiError, JiraRequestScopeChanged, type JiraRequestScope } from "./client";
import { canCreateIssues, createFields, createIssue, createIssueTypes } from "./create-issue";
import { createErrors, createPayload, missingFields, planFields } from "./create-issue-form";
import { fetchCreationParent } from "./create-issue-parent";
import { isExactIssueKey } from "./issue-link";
import { readJiraAccount, type JiraQueryScope } from "./query-scope";
import { subtaskRowsAllowed } from "@/lib/jira/subtask-rows-capability";

export const SUBTASK_ROW_LIMITS = { rows: 8, characters: 2048, title: 255 } as const;

type SubtaskRow = { line: number; title: string; problem?: string };
type ParsedRows = { rows: SubtaskRow[]; problem?: string };

export type SubtaskRowsTarget = {
  scope: JiraQueryScope;
  siteUrl: string;
  parent: { id: string; key: string; summary: string };
  project: { id: string; key: string; name: string };
  type: { id: string; name: string };
};

export type SubtaskRowsPreview = ParsedRows & { target: SubtaskRowsTarget };

export type SubtaskRowResult = SubtaskRow & (
  | { status: "created"; issueKey: string }
  | { status: "blocked" | "rejected" | "uncertain" | "unselected"; message: string }
);

export function parseSubtaskRows(text: string): ParsedRows {
  if (text.length > SUBTASK_ROW_LIMITS.characters) return { rows: [], problem: `Der Entwurf darf höchstens ${SUBTASK_ROW_LIMITS.characters} Zeichen enthalten.` };
  if (!text.trim()) return { rows: [], problem: "Gib mindestens einen Titel ein." };
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.at(-1) === "") lines.pop();
  if (lines.length > SUBTASK_ROW_LIMITS.rows) return { rows: [], problem: `Der Entwurf darf höchstens ${SUBTASK_ROW_LIMITS.rows} Zeilen enthalten.` };

  const seen = new Map<string, number>();
  const titles = lines.map((line) => line.trim());
  const identity = (title: string) => title.normalize("NFC").toLocaleLowerCase("de");
  for (const title of titles) {
    const key = identity(title);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return { rows: titles.map((title, index) => {
    const problem = !title ? "Titel fehlt."
      : /[\u0000-\u001f\u007f\u2028\u2029]/u.test(lines[index]!) ? "Die Zeile enthält ein nicht unterstütztes Steuerzeichen."
      : title.length > SUBTASK_ROW_LIMITS.title ? `Titel hat mehr als ${SUBTASK_ROW_LIMITS.title} Zeichen.`
      : (seen.get(identity(title)) ?? 0) > 1 ? "Titel ist im Entwurf doppelt." : undefined;
    return { line: index + 1, title, problem };
  }) };
}

class SubtaskTargetUnavailable extends Data.TaggedError("SubtaskTargetUnavailable")<{ message: string }> {}

const SCOPE_CHANGED = "Konto oder Zielkontext hat sich geändert.";

const checkTarget = (target: SubtaskRowsTarget, request: JiraRequestScope) => Effect.gen(function* () {
  const { accountId } = yield* readJiraAccount(request);
  if (accountId !== target.scope.accountId) return yield* new SubtaskTargetUnavailable({ message: SCOPE_CHANGED });
  const permitted = yield* canCreateIssues(target.project.id, request);
  if (!permitted) return yield* new SubtaskTargetUnavailable({ message: "Die Berechtigung zum Erstellen fehlt." });
  const types = yield* createIssueTypes(target.project.id, request);
  if (types.filter(({ id }) => id === target.type.id).length !== 1 || !types.some(({ id, subtask }) => id === target.type.id && subtask === true))
    return yield* new SubtaskTargetUnavailable({ message: "Der gewählte Unteraufgabentyp ist nicht mehr eindeutig verfügbar." });

  const fields = yield* createFields(target.project.id, target.type.id, request);
  const present = new Set(fields.map(({ fieldId }) => fieldId));
  if (!present.has("summary") || present.size !== fields.length || fields.some(({ fieldId, operations }) =>
    ["summary", "parent", "project", "issuetype"].includes(fieldId) && operations?.length && !operations.includes("set"))) {
    return yield* new SubtaskTargetUnavailable({ message: "Jira liefert keine eindeutigen und schreibbaren Angaben für Titel und Ziel." });
  }
  const plan = planFields(fields, target.parent.key);
  const missing = new Set(missingFields({ summary: "Unteraufgabe", description: null, values: {} }, plan));
  const required = [...plan.blocked, ...fields.filter(({ fieldId }) => missing.has(fieldId))];
  if (required.length) return yield* new SubtaskTargetUnavailable({ message: `Weitere Pflichtangaben im Einzelformular ausfüllen: ${required.map(({ name }) => name).join(", ")}.` });

  const parent = yield* fetchCreationParent(target.parent.key, request);
  if (parent.id !== target.parent.id || parent.key !== target.parent.key || parent.fields.project.id !== target.project.id
    || parent.fields.project.key !== target.project.key || parent.fields.issuetype.subtask !== false)
    return yield* new SubtaskTargetUnavailable({ message: "Das übergeordnete Ticket oder sein Projekt konnte nicht mehr bestätigt werden." });
  if (!request.isCurrent()) return yield* new SubtaskTargetUnavailable({ message: SCOPE_CHANGED });
  return { fields, plan };
});

const targetProblem = (error: unknown) => error instanceof SubtaskTargetUnavailable ? error.message
  : error instanceof JiraRequestScopeChanged ? SCOPE_CHANGED
  : "Jira-Ziel oder Pflichtfelder konnten nicht geprüft werden.";

export const previewSubtaskRows = (text: string, target: SubtaskRowsTarget, request: JiraRequestScope) => Effect.gen(function* () {
  const parsed = parseSubtaskRows(text);
  if (!parsed.rows.some((row) => !row.problem)) return { ...parsed, target };
  return yield* checkTarget(target, request).pipe(Effect.match({
    onSuccess: () => ({ ...parsed, target }),
    onFailure: (error) => ({ ...parsed, target, problem: targetProblem(error) }),
  }));
});

const REJECTED_STATUSES = new Set([400, 401, 403, 404, 409, 413, 415, 422, 429]);

export const submitSubtaskRows = (preview: SubtaskRowsPreview, selected: readonly number[], request: JiraRequestScope) => Effect.gen(function* () {
  const { target } = preview;
  const current = () => request.isCurrent() && subtaskRowsAllowed(target.scope, target.siteUrl);
  const results: SubtaskRowResult[] = [];
  let stop = preview.problem;
  for (const row of preview.rows) {
    if (row.problem) results.push({ ...row, status: "blocked", message: row.problem });
    else if (!selected.includes(row.line)) results.push({ ...row, status: "unselected", message: "Nicht ausgewählt." });
    else {
      if (!current()) stop ??= "Der aktuelle Kontext lässt keine Abgabe zu.";
      const result: SubtaskRowResult = stop ? { ...row, status: "blocked", message: stop } : yield* checkTarget(target, request).pipe(
        Effect.flatMap(({ fields, plan }) => {
          const { fields: payload } = createPayload(target.project.id, target.type.id, { summary: row.title, description: null, values: {} }, plan);
          let dispatched = false;
          const uncertain = (): SubtaskRowResult => {
            stop = "Nach unklarer Rückmeldung angehalten.";
            return { ...row, status: "uncertain", message: "Jira hat die Anlage nicht eindeutig bestätigt. Prüfe das übergeordnete Ticket vor einer erneuten Abgabe." };
          };
          return createIssue({ fields: { ...payload, parent: { id: target.parent.id } } }, {
            ...request, isCurrent: current, onDispatch: () => { dispatched = true; },
          }, { retry: false }).pipe(Effect.match({
            onSuccess: ({ id, key }): SubtaskRowResult => id.trim() && id !== target.parent.id && isExactIssueKey(key)
              && key !== target.parent.key && key.startsWith(`${target.project.key}-`)
              ? { ...row, status: "created", issueKey: key } : uncertain(),
            onFailure: (error): SubtaskRowResult => {
              if (!dispatched) {
                stop = !current() ? SCOPE_CHANGED : "Die Abgabe konnte nicht gestartet werden.";
                return { ...row, status: "blocked", message: stop };
              }
              if (error instanceof JiraApiError && REJECTED_STATUSES.has(error.status)) {
                const details = createErrors(error, fields, plan);
                return { ...row, status: "rejected", message: [...details.global, ...Object.values(details.fields)].join(" ") };
              }
              return uncertain();
            },
          }));
        }),
        Effect.catch((error) => {
          stop = targetProblem(error);
          return Effect.succeed<SubtaskRowResult>({ ...row, status: "blocked", message: stop });
        }),
      );
      results.push(result);
    }
  }
  return results;
});
