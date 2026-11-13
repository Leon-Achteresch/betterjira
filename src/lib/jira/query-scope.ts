import type { QueryClient } from "@tanstack/react-query";
import { Data, Effect, Schema } from "effect";
import { currentSite, type JiraRequestScope } from "./client";
import { jiraKeys } from "./queries";

export type JiraQueryScope = { cloudId: string; accountId: string };

export class JiraQueryScopeChanged extends Data.TaggedError("JiraQueryScopeChanged")<{}> {}

const AccountScope = Schema.Struct({ accountId: Schema.String });
const SiteScope = Schema.Struct({ cloudId: Schema.String });

export const jiraQueryScopeMatches = (client: QueryClient, scope: JiraQueryScope | undefined) => {
  const site = client.getQueryData(jiraKeys.site);
  const account = client.getQueryData(jiraKeys.myself);
  return !!scope && Schema.is(SiteScope)(site) && site.cloudId === scope.cloudId
    && Schema.is(AccountScope)(account) && account.accountId === scope.accountId;
};

export const jiraRequestScope = (client: QueryClient, scope: JiraQueryScope): JiraRequestScope => ({
  cloudId: scope.cloudId,
  isCurrent: () => jiraQueryScopeMatches(client, scope),
});

const ensureScope = (client: QueryClient, scope: JiraQueryScope | undefined) =>
  Effect.gen(function* () {
    if (!jiraQueryScopeMatches(client, scope)) return yield* new JiraQueryScopeChanged();
    const site = yield* currentSite;
    if (!scope || site?.cloudId !== scope.cloudId || !jiraQueryScopeMatches(client, scope)) return yield* new JiraQueryScopeChanged();
  });

export const withJiraQueryScope = <A, E, R>(client: QueryClient, scope: JiraQueryScope | undefined, program: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    yield* ensureScope(client, scope);
    const result = yield* program;
    yield* ensureScope(client, scope);
    return result;
  });
