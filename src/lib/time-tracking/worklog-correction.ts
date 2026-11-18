import { Data, Effect, Option, Schema } from "effect";
import { jira, JiraApiError, type JiraRequestScope } from "@/lib/jira/client";
import { MyPermissions } from "@/lib/jira/comment-permissions";
import { isExactIssueKey } from "@/lib/jira/issue-link";
import { readJiraAccount } from "@/lib/jira/query-scope";
import { parseJiraTimestamp } from "./aggregate";
import { Worklog } from "./client";

export const WORKLOG_TARGET_KEY_LIMIT = 80;
export const exactWorklogTarget = (text: string) => {
  const key = text.trim().toUpperCase();
  return key.length <= WORKLOG_TARGET_KEY_LIMIT && isExactIssueKey(key) ? key : undefined;
};

const FreshWorklog = Schema.Struct({ ...Worklog.fields, issueId: Schema.String, visibility: Schema.optional(Schema.Unknown) });
const TargetIssue = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  fields: Schema.Struct({ summary: Schema.String, project: Schema.Struct({ id: Schema.String, key: Schema.String }) }),
});

export type WorklogCorrectionSource = { issueId: string; issueKey: string; worklog: Worklog };
export type WorklogTarget = { id: string; key: string; summary: string; projectId: string; projectKey: string };

type Problem = "target" | "target-changed" | "same" | "rights" | "source" | "source-changed" | "author" | "visibility" | "account";
export class WorklogCorrectionBlocked extends Data.TaggedError("WorklogCorrectionBlocked")<{ reason: Problem }> {}

const reasonText: Record<Problem, string> = {
  target: "Der Zielvorgang ist nicht erreichbar.",
  "target-changed": "Der Zielvorgang hat sich geändert. Prüfe den Schlüssel erneut.",
  same: "Wähle einen anderen Vorgang als die Quelle.",
  rights: "Die erforderlichen Jira-Rechte konnten nicht bestätigt werden.",
  source: "Die Quellbuchung konnte nicht frisch gelesen werden.",
  "source-changed": "Die Quellbuchung hat sich geändert. Aktualisiere die Zeiterfassung und wähle sie erneut.",
  author: "Diese Buchung gehört nicht zum aktuellen Jira-Konto.",
  visibility: "Die Sichtbarkeit der Quellbuchung ist eingeschränkt. Für diesen Fall gibt es keine Korrekturvorschau.",
  account: "Das Jira-Konto konnte für diese Prüfung nicht bestätigt werden.",
};

export const worklogCorrectionError = (error: unknown) => error instanceof WorklogCorrectionBlocked
  ? reasonText[error.reason] : "Die Prüfung konnte nicht abgeschlossen werden. Versuche es erneut.";

const blocked = (reason: Problem) => new WorklogCorrectionBlocked({ reason });
const scopedRead = (scope: JiraRequestScope) => ({ scope, cache: "no-store" } as const);

const verifyAccount = (accountId: string, scope: JiraRequestScope) => Effect.gen(function* () {
  const identity = yield* readJiraAccount(scope).pipe(Effect.mapError(() => blocked("account")));
  if (identity.accountId !== accountId || !scope.isCurrent()) return yield* blocked("account");
});

const checkedTarget = (key: string, source: WorklogCorrectionSource, scope: JiraRequestScope) => Effect.gen(function* () {
  if (key === source.issueKey) return yield* blocked("same");
  const issue = yield* jira(`/issue/${encodeURIComponent(key)}?fields=summary,project`, TargetIssue, scopedRead(scope)).pipe(
    Effect.mapError((error) => blocked(error instanceof JiraApiError && error.status === 403 ? "rights" : "target")),
  );
  if (issue.id === source.issueId) return yield* blocked("same");
  const { project, summary } = issue.fields;
  if (issue.key !== key || !issue.id.trim() || !project.id.trim() || !project.key.trim()) return yield* blocked("target-changed");
  return { id: issue.id, key: issue.key, summary, projectId: project.id, projectKey: project.key } satisfies WorklogTarget;
});

export const readWorklogCorrectionTarget = (key: string, source: WorklogCorrectionSource, accountId: string, scope: JiraRequestScope) =>
  Effect.gen(function* () {
    yield* verifyAccount(accountId, scope);
    return yield* checkedTarget(key, source, scope);
  });

const readPermissions = (issueId: string, names: readonly string[], scope: JiraRequestScope) =>
  jira(`/mypermissions?${new URLSearchParams({ issueId, permissions: names.join(",") })}`, MyPermissions, scopedRead(scope))
    .pipe(Effect.map(({ permissions }) => permissions), Effect.mapError(() => blocked("rights")));

const sameJson = Schema.toEquivalence(Schema.Json);
const json = Schema.is(Schema.Json);
const equalComment = (first: unknown, second: unknown) => {
  const left = first ?? null;
  const right = second ?? null;
  return left === right || (json(left) && json(right) && sameJson(left, right));
};

const PlainAdf = Schema.Struct({
  type: Schema.Literal("doc"),
  version: Schema.Literal(1),
  content: Schema.Array(Schema.Struct({
    type: Schema.Literal("paragraph"),
    content: Schema.optional(Schema.Array(Schema.Union([
      Schema.Struct({ type: Schema.Literal("text"), text: Schema.String }),
      Schema.Struct({ type: Schema.Literal("hardBreak") }),
    ]))),
  })),
});

export const correctionText = (comment: unknown) => {
  if (comment == null || comment === "") return { kind: "empty" } as const;
  if (typeof comment === "string") return { kind: "text", text: comment } as const;
  const adf = Schema.decodeUnknownOption(PlainAdf)(comment, { onExcessProperty: "error" });
  if (Option.isNone(adf)) return { kind: "unsupported" } as const;
  const text = adf.value.content.map(({ content }) => (content ?? []).map((item) => item.type === "text" ? item.text : "\n").join("")).join("\n");
  return { kind: "text", text } as const;
};

const sameSnapshot = (selected: Worklog, fresh: Worklog) =>
  parseJiraTimestamp(selected.started) === parseJiraTimestamp(fresh.started)
  && selected.timeSpentSeconds === fresh.timeSpentSeconds
  && (selected.updated == null || selected.updated === fresh.updated)
  && equalComment(selected.comment, fresh.comment);

export const previewWorklogCorrection = (
  source: WorklogCorrectionSource, confirmed: WorklogTarget, accountId: string, scope: JiraRequestScope,
) => Effect.gen(function* () {
  yield* verifyAccount(accountId, scope);
  const target = yield* checkedTarget(confirmed.key, source, scope);
  if (target.id !== confirmed.id || target.projectId !== confirmed.projectId
    || target.projectKey !== confirmed.projectKey || target.summary !== confirmed.summary) return yield* blocked("target-changed");

  const fresh = yield* jira(
    `/issue/${encodeURIComponent(source.issueId)}/worklog/${encodeURIComponent(source.worklog.id)}`,
    FreshWorklog, scopedRead(scope),
  ).pipe(Effect.mapError(() => blocked("source")));
  if (fresh.id !== source.worklog.id || fresh.issueId !== source.issueId) return yield* blocked("source-changed");
  if (fresh.author?.accountId !== accountId) return yield* blocked("author");
  if (fresh.visibility != null) return yield* blocked("visibility");
  if (!sameSnapshot(source.worklog, fresh) || !Number.isSafeInteger(fresh.timeSpentSeconds) || fresh.timeSpentSeconds <= 0
    || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(fresh.started)) return yield* blocked("source-changed");

  const rights = yield* Effect.all({
    source: readPermissions(source.issueId, ["BROWSE_PROJECTS", "DELETE_OWN_WORKLOGS", "DELETE_ALL_WORKLOGS"], scope),
    target: readPermissions(target.id, ["BROWSE_PROJECTS", "WORK_ON_ISSUES"], scope),
  }, { concurrency: 2 });
  if (rights.source.BROWSE_PROJECTS?.havePermission !== true
    || !(rights.source.DELETE_OWN_WORKLOGS?.havePermission === true || rights.source.DELETE_ALL_WORKLOGS?.havePermission === true)
    || rights.target.BROWSE_PROJECTS?.havePermission !== true
    || rights.target.WORK_ON_ISSUES?.havePermission !== true) return yield* blocked("rights");
  yield* verifyAccount(accountId, scope);
  return { target, started: fresh.started, seconds: fresh.timeSpentSeconds, comment: correctionText(fresh.comment) };
});

export type WorklogCorrectionPreview = Effect.Success<ReturnType<typeof previewWorklogCorrection>>;
