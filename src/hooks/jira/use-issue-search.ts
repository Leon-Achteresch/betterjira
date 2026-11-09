import { useInfiniteQuery } from "@tanstack/react-query";
import { useJiraSite } from "@/lib/jira/queries";
import { PAGE_SIZE } from "@/lib/jira/search";
import { issueSearchQuery } from "@/lib/jira/search-query";

export const useIssueSearch = (jql: string, fields: readonly string[], pageSize = PAGE_SIZE) => {
  const site = useJiraSite();
  return useInfiniteQuery({
    ...issueSearchQuery(jql, fields, pageSize),
    enabled: !!site.data && jql.trim() !== "",
  });
};
