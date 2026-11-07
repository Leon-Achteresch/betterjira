import type { QueryClient } from "@tanstack/react-query";
import { Effect, Schema, Semaphore } from "effect";
import { jira } from "./client";
import { jiraKeys } from "./queries";
import { JiraQueryScopeChanged as IssueTabScopeChanged, jiraQueryScopeMatches, withJiraQueryScope } from "./query-scope";

export { JiraQueryScopeChanged as IssueTabScopeChanged } from "./query-scope";

export const ISSUE_TITLE_CONCURRENCY = 4;
export const ISSUE_TITLE_STALE_TIME = 5 * 60_000;

export type IssueTabScope = { cloudId: string; accountId: string };
export type CachedSummary = { summary: string | undefined; updatedAt: number };

export const NO_SUMMARY: CachedSummary = { summary: undefined, updatedAt: 0 };

const IssueTitle = Schema.Struct({
  key: Schema.String,
  fields: Schema.Struct({ summary: Schema.String }),
});

const DetailSummary = Schema.Struct({ fields: Schema.Struct({ summary: Schema.String }) });

const titleSlots = Semaphore.makeUnsafe(ISSUE_TITLE_CONCURRENCY);

export const issueTabMetadataKeys = {
  title: (cloudId: string, accountId: string, key: string) => [...jiraKeys.issue(key), "tab-title", cloudId, accountId] as const,
};

export const fetchIssueTitle = (client: QueryClient, scope: IssueTabScope | undefined, key: string) =>
  withJiraQueryScope(client, scope, jira(`/issue/${encodeURIComponent(key)}?fields=summary`, IssueTitle).pipe(
    Effect.map(({ fields }) => fields.summary),
  )).pipe(titleSlots.withPermits(1));

type DetailState = { data: unknown; dataUpdatedAt: number; isInvalidated: boolean } | undefined;

export const reusableSummary = (state: DetailState, now: number) =>
  state && !state.isInvalidated && now - state.dataUpdatedAt < ISSUE_TITLE_STALE_TIME && Schema.is(DetailSummary)(state.data)
    ? state.data.fields.summary
    : undefined;

export const issueTabTitleQuery = (client: QueryClient, scope: IssueTabScope | undefined, key: string, active: boolean) => ({
  queryKey: issueTabMetadataKeys.title(scope?.cloudId ?? "", scope?.accountId ?? "", key),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    Effect.runPromise(Effect.suspend(() => {
      if (!jiraQueryScopeMatches(client, scope)) return Effect.fail(new IssueTabScopeChanged());
      const cached = reusableSummary(client.getQueryState(jiraKeys.issueDetail(key, scope)), Date.now());
      return cached !== undefined ? Effect.succeed(cached) : fetchIssueTitle(client, scope, key);
    }), { signal }),
  enabled: !!scope && !active,
  staleTime: ISSUE_TITLE_STALE_TIME,
  retry: false,
  refetchOnWindowFocus: ({ state }: { state: { status: string } }) => state.status !== "error",
});

export const newestSummary = (title: CachedSummary, detail: CachedSummary) =>
  detail.summary !== undefined && (title.summary === undefined || detail.updatedAt >= title.updatedAt) ? detail.summary : title.summary;
