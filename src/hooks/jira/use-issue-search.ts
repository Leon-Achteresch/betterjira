import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useJiraSite, useJiraMyself } from "@/lib/jira/queries";
import { PAGE_SIZE } from "@/lib/jira/search";
import { issueSearchQuery } from "@/lib/jira/search-query";

export const useIssueSearch = (jql: string, fields: readonly string[], pageSize = PAGE_SIZE) => {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const client = useQueryClient();
  const scope = site.isSuccess && site.data && myself.isSuccess && myself.data ? { cloudId: site.data.cloudId, accountId: myself.data.accountId } : undefined;
  const options = issueSearchQuery(jql, fields, pageSize, { client, scope });
  const query = useInfiniteQuery({
    ...options,
    enabled: !!scope && jql.trim() !== "",
  });
  return { ...query, queryKey: options.queryKey, scope };
};
