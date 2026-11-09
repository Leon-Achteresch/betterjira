import { useQueries, useQueryClient } from "@tanstack/react-query";
import { issueTabTitleQuery, newestSummary, NO_SUMMARY } from "@/lib/jira/issue-tab-metadata";
import { issueQuery, useJiraMyself, useJiraSite } from "@/lib/jira/queries";

export function useIssueTabMetadata(keys: readonly string[], activeKey: string | undefined) {
  const client = useQueryClient();
  const site = useJiraSite();
  const myself = useJiraMyself();
  const scope = site.data && myself.data ? { cloudId: site.data.cloudId, accountId: myself.data.accountId } : undefined;
  const details = useQueries({ queries: keys.map((key) => ({ ...issueQuery(key, scope, client), enabled: false })) });
  const titles = useQueries({ queries: keys.map((key) => issueTabTitleQuery(client, scope, key, key === activeKey)) });
  if (!scope) return keys.map(() => undefined);
  return titles.map(({ data, dataUpdatedAt }, index) => {
    const detail = details[index];
    return newestSummary(
      { summary: data, updatedAt: dataUpdatedAt },
      detail ? { summary: detail.data?.fields.summary, updatedAt: detail.dataUpdatedAt } : NO_SUMMARY,
    );
  });
}
