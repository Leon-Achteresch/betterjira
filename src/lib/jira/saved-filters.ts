import { Effect, Schema } from "effect";
import {
  jira,
  JiraApiError,
  JiraRequestScopeChanged,
  NotAuthenticated,
  type JiraRequestScope,
} from "./client";
import { readJiraAccount, type JiraQueryScope } from "./query-scope";

const FilterRows = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    favourite: Schema.optional(Schema.Boolean),
    jql: Schema.optional(Schema.Unknown),
  }),
);
type FilterRow = (typeof FilterRows.Type)[number];
export type JiraFilter = Omit<FilterRow, "jql"> & { jql?: string };
export type JiraFilterScope = JiraQueryScope & { siteUrl: string };

export const filterAccessLost = (error: unknown) =>
  error instanceof JiraRequestScopeChanged ||
  error instanceof NotAuthenticated ||
  (error instanceof JiraApiError && [401, 403, 404].includes(error.status));

export const mergeSavedFilters = (rows: readonly FilterRow[]): JiraFilter[] => {
  const unique = new Map<
    string,
    { filter: FilterRow; favourite: boolean; contents: Set<string> }
  >();
  for (const filter of rows) {
    const entry = unique.get(filter.id) ?? {
      filter,
      favourite: false,
      contents: new Set<string>(),
    };
    entry.favourite ||= filter.favourite === true;
    if (typeof filter.jql === "string" && filter.jql.trim())
      entry.contents.add(filter.jql);
    unique.set(filter.id, entry);
  }
  return [...unique.values()].map(({ filter, favourite, contents }) => ({
    id: filter.id,
    name: filter.name,
    favourite,
    jql: contents.size === 1 ? contents.values().next().value : undefined,
  }));
};

export const withFilterAccount = <A, E, R>(
  accountId: string,
  scope: JiraRequestScope,
  read: Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const check = Effect.gen(function* () {
      const account = yield* readJiraAccount(scope, false);
      if (account.accountId !== accountId || !scope.isCurrent())
        return yield* new JiraRequestScopeChanged();
    });
    yield* check;
    const result = yield* read;
    yield* check;
    return result;
  });

export const fetchSavedFilters = (accountId: string, scope: JiraRequestScope) =>
  withFilterAccount(
    accountId,
    scope,
    jira("/filter/my?includeFavourites=true&expand=jql", FilterRows, {
      scope,
      cache: "no-store",
      retry: false,
    }),
  ).pipe(Effect.map(mergeSavedFilters));
