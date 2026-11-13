import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useJiraQueryScope } from "@/hooks/jira/use-jira-query-scope";
import { creationParentKey, fetchCreationParent } from "@/lib/jira/create-issue-parent";
import { withJiraQueryScope } from "@/lib/jira/query-scope";

export function useCreateIssueParent(key: string | undefined) {
  const client = useQueryClient();
  const { scope } = useJiraQueryScope();
  return useQuery({
    queryKey: creationParentKey(JSON.stringify(scope), key ?? ""),
    queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope, fetchCreationParent(key!)), { signal }),
    enabled: !!key && !!scope,
  });
}
