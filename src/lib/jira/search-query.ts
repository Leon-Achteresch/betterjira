import { infiniteQueryOptions, keepPreviousData, type QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { jiraKeys } from "./keys";
import { PAGE_SIZE, searchIssues } from "./search";
import { jiraRequestScope, withJiraQueryScope, type JiraQueryScope } from "./query-scope";
import { JiraApiError } from "./client";
import { searchContinuation } from "./search-loading";

export const issueSearchQuery = (jql: string, requestedFields: readonly string[], pageSize = PAGE_SIZE, account?: { client: QueryClient; scope: JiraQueryScope | undefined }) => {
  const fields = [...new Set(requestedFields)].sort();
  return infiniteQueryOptions({
    queryKey: account ? jiraKeys.searchScoped(jql, fields, pageSize, account.scope) : jiraKeys.search(jql, fields, pageSize),
    queryFn: ({ signal, pageParam }) => {
      const program = searchIssues(jql, fields, pageParam, pageSize, [], account?.scope ? jiraRequestScope(account.client, account.scope) : undefined).pipe(
        Effect.flatMap((page) => page.issues.length <= pageSize ? Effect.succeed(page) : Effect.fail(new JiraApiError({ status: 502, body: "Jira hat mehr Treffer als angefordert geliefert." }))),
      );
      return Effect.runPromise(account ? withJiraQueryScope(account.client, account.scope, program) : program, { signal });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page, _pages, token, tokens) => {
      const next = searchContinuation({ pages: [page], pageParams: [...tokens, token] });
      return next.kind === "more" ? next.token : undefined;
    },
    placeholderData: account ? (previous, previousQuery) => account.scope && previousQuery?.queryKey[6] === account.scope.cloudId && previousQuery.queryKey[7] === account.scope.accountId ? previous : undefined : keepPreviousData,
    retry: false,
  });
};
