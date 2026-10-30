import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { splitJql } from "@/lib/jira/jql";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";
import { countIssues } from "@/lib/jira/search";

export const useIssueCount = (jql: string) => {
  const site = useJiraSite();
  const { where } = splitJql(jql);
  return useQuery({
    queryKey: jiraKeys.issueCount(where),
    queryFn: ({ signal }) => Effect.runPromise(countIssues(where), { signal }),
    enabled: !!site.data && where !== "",
    retry: false,
  });
};
