import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useJiraQueryScope } from "@/hooks/jira/use-jira-query-scope";
import { needsRenderedFields } from "@/lib/jira/adf-media";
import { jiraKeys, type JiraIssueDetail } from "@/lib/jira/queries";
import { withJiraQueryScope } from "@/lib/jira/query-scope";
import { fetchRenderedIssue, type RenderedSource } from "@/lib/jira/rendered-issue";

const OFF: RenderedSource = { status: "off" };
const LOADING: RenderedSource = { status: "loading" };
const FAILED: RenderedSource = { status: "error" };

export function useIssueRendered(issue: JiraIssueDetail | undefined): RenderedSource {
  const client = useQueryClient();
  const { scope } = useJiraQueryScope();
  const key = issue?.key ?? "";
  const updated = issue?.fields.updated ?? "";
  const needed = useMemo(
    () => !!issue && needsRenderedFields(issue.fields.description, issue.fields.comment?.comments ?? []),
    [issue],
  );
  const query = useQuery({
    queryKey: jiraKeys.issueRendered(key, updated, scope),
    queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope, fetchRenderedIssue(key)), { signal }),
    enabled: needed && !!scope,
    staleTime: Infinity,
  });
  const data = query.data;
  const failed = query.isError;
  return useMemo<RenderedSource>(
    () => (!needed ? OFF : data ? { status: "ready", issue: data } : failed ? FAILED : LOADING),
    [needed, data, failed],
  );
}
