import { Cause, Data, Effect } from "effect";
import { Schema } from "effect";
import { jira, JiraApiError, type JiraRequestScope } from "./client";
import {
  createIssueLink,
  fetchLinkPermission,
  fetchLinkTypes,
  linkChoices,
  type LinkChoice,
  type IssueLinkType,
} from "./issue-link-actions";
import { hasIssueLink, summarizeIssueLinks } from "./issue-links";

export const MULTI_LINK_LIMIT = 20;
export const MULTI_LINK_INPUT_LIMIT = 6000;
const keyPattern = /^[A-Z][A-Z0-9_]*-\d+$/;
const validKey = (key: string) => key.length <= 255 && keyPattern.test(key);
export function parseMultiLinkTargets(source: string, input: string) {
  const raw = input
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean);
  const targets = raw.map((key) => key.toUpperCase());
  const unique = [...new Set(targets)].sort();
  const error = !validKey(source)
    ? "Die Quelle hat keinen gültigen Ticket-Key."
    : input.length > MULTI_LINK_INPUT_LIMIT
      ? "Die Eingabe ist zu lang (maximal 6.000 Zeichen)."
      : !targets.length
        ? "Gib mindestens einen Zielkey ein."
        : raw.some((key) => !/^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(key)) ||
            unique.some((key) => !validKey(key))
          ? "Nur Ticket-Keys, z. B. DEMO-2, mit maximal 255 Zeichen sind erlaubt."
          : unique.length > MULTI_LINK_LIMIT
            ? "Maximal 20 eindeutige Zielkeys sind möglich."
            : unique.includes(source)
              ? "Ein Ticket kann nicht mit sich selbst verknüpft werden."
              : unique.length !== targets.length
                ? "Zielkeys sind doppelt enthalten. Bitte die Duplikate entfernen."
                : null;
  return { targets: unique, error };
}

const LinkIssue = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  fields: Schema.Struct({
    summary: Schema.String,
    issuelinks: Schema.optional(Schema.Array(Schema.Unknown)),
  }),
});
type LinkIssue = typeof LinkIssue.Type;
export type MultiLinkRow = {
  key: string;
  id?: string;
  summary?: string;
  reason?: string;
};
export type MultiLinkPreview = {
  source: { key: string; id: string; summary: string };
  choice: LinkChoice;
  rows: readonly MultiLinkRow[];
  unreadable: number;
};
export type MultiLinkStatus =
  "confirmed" | "rejected" | "uncertain" | "not-started" | "sending";
export type MultiLinkResult = {
  key: string;
  status: MultiLinkStatus;
  message: string;
};
export type MultiLinkLedger = Record<string, "confirmed" | "uncertain">;
export class InvalidMultiLink extends Data.TaggedError("InvalidMultiLink")<{
  message: string;
}> {}

const readIssue = (key: string, scope: JiraRequestScope, links = false) =>
  jira(
    `/issue/${encodeURIComponent(key)}?fields=${links ? "summary,issuelinks" : "summary"}`,
    LinkIssue,
    { scope, retry: false, cache: "no-store" },
  );
export const linkChoiceIdentity = (choice: LinkChoice) =>
  JSON.stringify([
    choice.id,
    choice.type.id,
    choice.type.name,
    choice.type.inward,
    choice.type.outward,
    choice.direction,
  ]);
const checkedChoice = (
  types: readonly IssueLinkType[],
  selected: LinkChoice,
) => {
  const matches = linkChoices(types).filter(
    (choice) => choice.id === selected.id,
  );
  const choice = matches[0];
  return matches.length === 1 &&
    choice &&
    [
      choice.type.id,
      choice.type.name,
      choice.type.inward,
      choice.type.outward,
    ].every((value) => value.trim()) &&
    linkChoiceIdentity(choice) === linkChoiceIdentity(selected)
    ? choice
    : undefined;
};
export const multiLinkChoices = (types: readonly IssueLinkType[]) =>
  linkChoices(types).filter((choice) => !!checkedChoice(types, choice));
const exists = (source: LinkIssue, key: string, choice: LinkChoice) =>
  hasIssueLink(
    source.fields.issuelinks ?? [],
    key,
    choice.type.id,
    choice.direction,
    choice.type.inward === choice.type.outward,
  );
const held = (status: MultiLinkLedger[string] | undefined) =>
  status === "confirmed"
    ? "In dieser Sitzung bereits bestätigt. Wird nicht erneut gesendet."
    : status === "uncertain"
      ? "Früherer Ausgang unklar. Zuerst in Jira prüfen; hier keine erneute Abgabe."
      : undefined;

export const previewMultiTicketLinks = (
  sourceKey: string,
  input: string,
  selected: LinkChoice,
  scope: JiraRequestScope,
  ledger: MultiLinkLedger = {},
) =>
  Effect.gen(function* () {
    const parsed = parseMultiLinkTargets(sourceKey, input);
    if (parsed.error)
      return yield* new InvalidMultiLink({ message: parsed.error });
    const types = yield* fetchLinkTypes(scope);
    const choice = checkedChoice(types, selected);
    if (!choice)
      return yield* new InvalidMultiLink({
        message:
          "Beziehung oder Richtung ist nicht mehr verfügbar. Typen neu laden und bewusst auswählen.",
      });
    const source = yield* readIssue(sourceKey, scope, true);
    const permission = yield* fetchLinkPermission(sourceKey, scope);
    if (source.key !== sourceKey || !permission || !source.fields.issuelinks)
      return yield* new InvalidMultiLink({
        message:
          "Quelle, bestehende Beziehungen oder Verknüpfungsberechtigung konnte nicht bestätigt werden.",
      });
    const rows = yield* Effect.forEach(
      parsed.targets,
      (key): Effect.Effect<MultiLinkRow> => {
        const reason =
          held(ledger[key]) ??
          (exists(source, key, choice)
            ? "Diese Beziehung besteht bereits."
            : undefined);
        if (reason) return Effect.succeed({ key, reason });
        return Effect.gen(function* () {
          const issue = yield* readIssue(key, scope);
          const allowed = yield* fetchLinkPermission(key, scope);
          return {
            key,
            id: issue.id,
            summary: issue.fields.summary,
            reason:
              issue.key !== key
                ? "Ticket-Key wurde geändert; bitte neu auswählen."
                : !allowed
                  ? "Verknüpfen ist für dieses Ziel nicht erlaubt."
                  : undefined,
          };
        }).pipe(
          Effect.catchCause(() =>
            Effect.succeed({
              key,
              reason:
                "Ziel oder Berechtigung konnte nicht gelesen werden. Keine Abgabe vorgesehen.",
            }),
          ),
        );
      },
      { concurrency: 2 },
    );
    return {
      source: {
        key: source.key,
        id: source.id,
        summary: source.fields.summary,
      },
      choice,
      rows,
      unreadable: summarizeIssueLinks(source.fields.issuelinks).unreadable,
    };
  });

export const applyMultiTicketLinks = (
  preview: MultiLinkPreview,
  scope: JiraRequestScope,
  ledger: () => MultiLinkLedger,
  onResult: (result: MultiLinkResult) => void = () => undefined,
) =>
  Effect.gen(function* () {
    const parsed = parseMultiLinkTargets(
      preview.source.key,
      preview.rows.map((row) => row.key).join("\n"),
    );
    if (parsed.error)
      return yield* new InvalidMultiLink({ message: parsed.error });
    const fresh = yield* Effect.exit(
      Effect.gen(function* () {
        if (!scope.isCurrent())
          return yield* new InvalidMultiLink({
            message: "Gestoppt oder Kontext gewechselt.",
          });
        const types = yield* fetchLinkTypes(scope);
        const choice = checkedChoice(types, preview.choice);
        const source = yield* readIssue(preview.source.key, scope, true);
        const allowed = yield* fetchLinkPermission(preview.source.key, scope);
        if (
          !choice ||
          !source.fields.issuelinks ||
          source.id !== preview.source.id ||
          source.key !== preview.source.key ||
          !allowed
        )
          return yield* new InvalidMultiLink({
            message: "Quelle, Beziehung oder Berechtigung geändert.",
          });
        return source;
      }),
    );
    return yield* Effect.forEach(
      preview.rows,
      (row) =>
        Effect.gen(function* () {
          let dispatched = false;
          const result = (
            status: MultiLinkStatus,
            message: string,
          ): MultiLinkResult => ({ key: row.key, status, message });
          const reason =
            row.reason ??
            held(ledger()[row.key]) ??
            (fresh._tag === "Success" &&
            exists(fresh.value, row.key, preview.choice)
              ? "Beziehung besteht inzwischen bereits."
              : undefined);
          let outcome: MultiLinkResult;
          if (
            fresh._tag !== "Success" ||
            !scope.isCurrent() ||
            reason ||
            !row.id
          )
            outcome = result(
              "not-started",
              reason ??
                "Gestoppt oder erneute Prüfung fehlgeschlagen. Keine Abgabe gestartet.",
            );
          else
            outcome = yield* Effect.gen(function* () {
              const target = yield* readIssue(row.key, scope);
              const allowed = yield* fetchLinkPermission(row.key, scope);
              if (
                !scope.isCurrent() ||
                !allowed ||
                target.key !== row.key ||
                target.id !== row.id
              )
                return result(
                  "not-started",
                  "Ziel, Berechtigung oder Kontext geändert. Keine Abgabe gestartet.",
                );
              yield* createIssueLink(
                {
                  source: preview.source.key,
                  target: row.key,
                  typeId: preview.choice.type.id,
                  direction: preview.choice.direction,
                },
                {
                  ...scope,
                  onDispatch: () => {
                    dispatched = true;
                    onResult(
                      result("sending", "Abgegeben; Bestätigung steht aus."),
                    );
                  },
                },
                false,
              );
              return result(
                "confirmed",
                "Jira hat die Einzelverknüpfung bestätigt.",
              );
            }).pipe(
              Effect.catchCause((cause) => {
                const error = Cause.squash(cause);
                return Effect.succeed(
                  !dispatched
                    ? result(
                        "not-started",
                        "Vor der Abgabe gestoppt oder Prüfung fehlgeschlagen.",
                      )
                    : error instanceof JiraApiError &&
                        error.status >= 400 &&
                        error.status < 500 &&
                        error.status !== 408
                      ? result(
                          "rejected",
                          `Von Jira abgelehnt (HTTP ${error.status}).`,
                        )
                      : result(
                          "uncertain",
                          "Ausgang unklar. Nicht erneut senden; zuerst in Jira prüfen.",
                        ),
                );
              }),
            );
          yield* Effect.sync(() => onResult(outcome));
          return outcome;
        }),
      { concurrency: 2 },
    );
  });
