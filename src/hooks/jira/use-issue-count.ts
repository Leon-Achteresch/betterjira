import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { splitJql } from "@/lib/jira/jql";
import { jiraKeys, useJiraSite, useJiraMyself } from "@/lib/jira/queries";
import { jiraRequestScope, withJiraQueryScope } from "@/lib/jira/query-scope";
import { countIssues } from "@/lib/jira/search";

export const useIssueCount = (jql: string) => {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const client = useQueryClient();
  const scope = site.isSuccess && site.data && myself.isSuccess && myself.data ? { cloudId: site.data.cloudId, accountId: myself.data.accountId } : undefined;
  const { where } = splitJql(jql);
  return useQuery({
    queryKey: jiraKeys.issueCountScoped(where, scope),
    queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope, countIssues(where, scope && jiraRequestScope(client, scope))), { signal }),
    enabled: !!scope && where !== "",
    retry: false,
  });
};
