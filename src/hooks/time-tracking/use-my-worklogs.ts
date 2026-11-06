import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { aggregateWorklogs } from "@/lib/time-tracking/aggregate";
import { type CandidateIssue, fetchCandidateIssues, fetchIssueWorklogs } from "@/lib/time-tracking/client";
import { timeCoverage } from "@/lib/time-tracking/coverage";
import { timeTrackingKeys, type TimeTrackingScope } from "@/lib/time-tracking/keys";
import type { TimeRange } from "@/lib/time-tracking/range";

const NO_ISSUES: readonly CandidateIssue[] = [];

export function useMyWorklogs(range: TimeRange) {
  const queryClient = useQueryClient();
  const site = useJiraSite();
  const myself = useJiraMyself();
  const { start, end } = range;
  const scope: TimeTrackingScope | undefined =
    site.data && myself.data ? { cloudId: site.data.cloudId, accountId: myself.data.accountId, start: start.getTime(), end: end.getTime() } : undefined;

  const candidates = useQuery({
    queryKey: scope ? timeTrackingKeys.candidates(scope) : timeTrackingKeys.all,
    queryFn: ({ signal }) => Effect.runPromise(fetchCandidateIssues(start, end), { signal }),
    enabled: !!scope,
    retry: false,
  });
  const issues = scope ? (candidates.data?.issues ?? NO_ISSUES) : NO_ISSUES;
  const worklogs = useQueries({
    queries: scope
      ? issues.map((issue) => ({
          queryKey: timeTrackingKeys.worklogs(scope, issue.id),
          queryFn: ({ signal }: { signal: AbortSignal }) => Effect.runPromise(fetchIssueWorklogs(issue.id, start, end), { signal }),
          retry: false,
        }))
      : [],
  });

  const results = issues.flatMap((issue, index) => {
    const data = worklogs[index]?.data;
    return data ? [{ issue, worklogs: data.worklogs }] : [];
  });
  const summary = scope ? aggregateWorklogs({ accountId: scope.accountId, start, end, days: range.days, results }) : undefined;
  const coverage = timeCoverage(
    !!candidates.data?.truncated,
    issues.map((issue, index) => {
      const query = worklogs[index];
      return {
        key: issue.key,
        status: query?.isError ? "error" : query?.data ? "success" : "pending",
        truncated: !!query?.data?.truncated,
      };
    }),
  );
  const accountError = myself.error;

  return {
    summary,
    coverage,
    issueCount: issues.length,
    pending: !accountError && (!scope || candidates.isPending),
    error: accountError ?? (candidates.data ? null : candidates.error),
    refreshError: candidates.data ? candidates.error : null,
    refreshing: candidates.isFetching || worklogs.some((query) => query.isFetching),
    retry: () => void (accountError ? myself.refetch() : candidates.refetch()),
    retryFailed: () => worklogs.forEach((query) => query.isError && void query.refetch()),
    refresh: () => void queryClient.invalidateQueries({ queryKey: timeTrackingKeys.all }),
  };
}
