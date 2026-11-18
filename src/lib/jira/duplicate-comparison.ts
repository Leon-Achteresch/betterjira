import { Data, Effect, Schema } from "effect";
import {
  JiraApiError,
  JiraRequestScopeChanged,
  NotAuthenticated,
  jira,
  type JiraRequestScope,
} from "./client";
import { confirmsDuplicateLink, type IssueLinkReference } from "./issue-links";
import { readJiraAccount } from "./query-scope";

const Fields = Schema.Struct({
  summary: Schema.optional(Schema.Unknown),
  status: Schema.optional(Schema.Unknown),
  issuetype: Schema.optional(Schema.Unknown),
  priority: Schema.optional(Schema.Unknown),
  issuelinks: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),
});
const Ticket = Schema.Struct({ key: Schema.String, fields: Fields });
const Named = Schema.is(Schema.Struct({ name: Schema.String }));
const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const name = (value: unknown) => (Named(value) ? text(value.name) : undefined);

const comparisonFields = new URLSearchParams({
  fields: "summary,status,issuetype,priority,issuelinks",
});
const fetchTicket = (key: string, scope: JiraRequestScope) =>
  jira(`/issue/${encodeURIComponent(key)}?${comparisonFields}`, Ticket, {
    scope,
    cache: "no-store",
    retry: false,
  });

const normalizeKey = (key: string) => key.trim().toUpperCase();
const validKey = (key: string) =>
  key.length <= 255 && /^[A-Z][A-Z0-9_]*-\d+$/.test(key);
const comparable = ({ key, fields }: typeof Ticket.Type) => ({
  key,
  summary: text(fields.summary),
  status: name(fields.status),
  issueType: name(fields.issuetype),
  priority: name(fields.priority),
});

export class DuplicateLinkUnconfirmed extends Data.TaggedError(
  "DuplicateLinkUnconfirmed",
)<{}> {}

export const readDuplicateComparison = (
  sourceKey: string,
  linkedKey: string,
  reference: IssueLinkReference,
  accountId: string,
  scope: JiraRequestScope,
) =>
  Effect.gen(function* () {
    const source = normalizeKey(sourceKey);
    const linked = normalizeKey(linkedKey);
    if (
      !reference.duplicate ||
      !validKey(source) ||
      !validKey(linked) ||
      source === linked
    )
      return yield* new DuplicateLinkUnconfirmed();

    const checkAccount = Effect.gen(function* () {
      const account = yield* readJiraAccount(scope, false);
      if (account.accountId !== accountId || !scope.isCurrent())
        return yield* new JiraRequestScopeChanged();
    });
    yield* checkAccount;
    const current = yield* fetchTicket(source, scope);
    if (
      normalizeKey(current.key) !== source ||
      !confirmsDuplicateLink(current.fields.issuelinks ?? [], linked, reference)
    )
      return yield* new DuplicateLinkUnconfirmed();

    const other = yield* fetchTicket(linked, scope);
    const reverse = {
      ...reference,
      direction:
        reference.direction === "outward"
          ? ("inward" as const)
          : ("outward" as const),
    };
    if (
      normalizeKey(other.key) !== linked ||
      !confirmsDuplicateLink(other.fields.issuelinks ?? [], source, reverse)
    )
      return yield* new DuplicateLinkUnconfirmed();

    yield* checkAccount;
    return reference.direction === "outward"
      ? { duplicate: comparable(current), original: comparable(other) }
      : { duplicate: comparable(other), original: comparable(current) };
  });

export type DuplicateComparison = Effect.Success<
  ReturnType<typeof readDuplicateComparison>
>;

export function duplicateComparisonError(error: unknown) {
  if (error instanceof JiraRequestScopeChanged)
    return "Der Ticket- oder Kontokontext hat sich geändert.";
  if (error instanceof DuplicateLinkUnconfirmed)
    return "Der Duplikatlink konnte auf beiden Tickets nicht bestätigt werden.";
  if (
    error instanceof NotAuthenticated ||
    (error instanceof JiraApiError && [401, 403, 404].includes(error.status))
  )
    return "Mindestens ein Ticket ist für dieses Konto nicht lesbar.";
  return "Der Vergleich konnte nicht geladen werden.";
}
