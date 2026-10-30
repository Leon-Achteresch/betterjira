import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { computeProjectStats, fetchProjectStatsIssues } from "@/lib/jira/project-stats";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";

export const useProjectStats = (projectKey: string, enabled: boolean) => {
  const site = useJiraSite();
  const query = useQuery({
    queryKey: jiraKeys.projectStats(projectKey),
    queryFn: ({ signal }) => Effect.runPromise(fetchProjectStatsIssues(projectKey), { signal }),
    enabled: enabled && !!site.data,
    staleTime: 5 * 60_000,
  });
  const stats = useMemo(
    () => (query.data ? computeProjectStats(query.data.issues, new Date(query.dataUpdatedAt)) : undefined),
    [query.data, query.dataUpdatedAt],
  );
  return { ...query, stats, truncated: query.data?.truncated ?? false };
};
