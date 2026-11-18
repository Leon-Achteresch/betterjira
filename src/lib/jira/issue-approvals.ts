import { Data, Effect, Schema } from "effect";
import {
  JiraApiError,
  JiraRequestScopeChanged,
  jiraRequestApprovals,
  type JiraRequestScope,
} from "./client";
import { readJiraAccount } from "./query-scope";

const PAGE_SIZE = 8;
const Text = Schema.Trim.pipe(Schema.check(Schema.isMinLength(1)));
const Approval = Schema.Struct({
  id: Text,
  name: Text,
  finalDecision: Text,
  approvers: Schema.optional(Schema.Unknown),
});
const Page = Schema.Struct({
  start: Schema.Literal(0),
  isLastPage: Schema.Boolean,
  size: Schema.optional(Schema.Number),
  values: Schema.Array(Approval),
});
const isList = Schema.is(Schema.Array(Schema.Unknown));
const hasVisibleName = Schema.is(
  Schema.Struct({
    approver: Schema.Struct({ displayName: Schema.String }),
  }),
);

export class IssueApprovalsUnconfirmed extends Data.TaggedError(
  "IssueApprovalsUnconfirmed",
)<{}> {}

const visibleNames = (approvers: unknown) =>
  isList(approvers)
    ? [
        ...new Set(
          approvers.flatMap((row) => {
            const name = hasVisibleName(row)
              ? row.approver.displayName.trim()
              : "";
            return name ? [name] : [];
          }),
        ),
      ]
    : [];

export const readIssueApprovals = (
  key: string,
  accountId: string,
  scope: JiraRequestScope,
) =>
  Effect.gen(function* () {
    if (key.length > 255 || !/^[A-Z][A-Z0-9_]*-\d+$/.test(key))
      return yield* new IssueApprovalsUnconfirmed();

    const checkAccount = Effect.gen(function* () {
      const account = yield* readJiraAccount(scope, false);
      if (account.accountId !== accountId || !scope.isCurrent())
        return yield* new JiraRequestScopeChanged();
    });
    yield* checkAccount;
    const page = yield* jiraRequestApprovals(key, PAGE_SIZE, Page, scope);
    if (
      page.values.length > PAGE_SIZE ||
      (page.size !== undefined && page.size !== page.values.length) ||
      new Set(page.values.map(({ id }) => id)).size !== page.values.length
    )
      return yield* new IssueApprovalsUnconfirmed();
    yield* checkAccount;

    return {
      partial: !page.isLastPage,
      stages: page.values.map(({ id, name, finalDecision, approvers }) => {
        const names = visibleNames(approvers);
        return {
          id,
          name,
          decision: finalDecision,
          names: names.slice(0, PAGE_SIZE),
          moreNames: names.length > PAGE_SIZE,
        };
      }),
    };
  });

export type IssueApprovals = Effect.Success<
  ReturnType<typeof readIssueApprovals>
>;

export function issueApprovalsError(error: unknown) {
  if (error instanceof JiraRequestScopeChanged)
    return "Der Ticket- oder Kontokontext hat sich geändert.";
  if (error instanceof JiraApiError && [401, 403].includes(error.status))
    return "Kein Lesezugriff auf die Freigaben dieser Anfrage.";
  if (error instanceof JiraApiError && error.status === 404)
    return "Für dieses Ticket konnte keine zugängliche JSM-Anfrage bestätigt werden.";
  return "Die Freigabedaten konnten nicht bestätigt werden.";
}
