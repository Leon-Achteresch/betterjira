import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useContextSession } from "@/hooks/use-context-session";
import { JiraRequestScopeChanged } from "@/lib/jira/client";
import { issueApprovalsAllowed } from "@/lib/jira/issue-approvals-capability";
import {
  issueApprovalsError,
  readIssueApprovals,
} from "@/lib/jira/issue-approvals";
import { jiraKeys } from "@/lib/jira/keys";
import { jiraQueryScopeMatches } from "@/lib/jira/query-scope";
import { useJiraMyself, useJiraSite } from "./use-jira";

export function useIssueApprovals(key: string | undefined) {
  const client = useQueryClient();
  const instance = useId();
  const account = useJiraMyself();
  const site = useJiraSite();
  const host = site.data?.siteUrl;
  const scope =
    site.data?.cloudId &&
    account.data?.accountId &&
    !site.isError &&
    !account.isError &&
    !account.isFetching
      ? { cloudId: site.data.cloudId, accountId: account.data.accountId }
      : undefined;
  const available = !!(
    key &&
    scope &&
    host &&
    issueApprovalsAllowed(scope, host)
  );
  const context = JSON.stringify([key, scope, host, available]);
  const session = useContextSession(context);
  const sequence = useRef(0);
  const [selected, setSelected] = useState<{
    token: typeof session.token;
    id: number;
  }>();
  const request =
    available && selected?.token === session.token ? selected : undefined;
  const isCurrent = () =>
    session.isCurrent() &&
    jiraQueryScopeMatches(client, scope) &&
    client.getQueryData<{ siteUrl: string }>(jiraKeys.site)?.siteUrl === host;
  const query = useQuery({
    queryKey: jiraKeys.issueApprovals(context, instance, request?.id),
    enabled: !!request,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({ signal }) => {
      if (!request || !key || !scope || !host || !available)
        throw new JiraRequestScopeChanged();
      return Effect.runPromise(
        readIssueApprovals(key, scope.accountId, {
          cloudId: scope.cloudId,
          siteUrl: host,
          isCurrent,
        }),
        { signal },
      );
    },
  });

  return {
    context,
    available,
    loading: !!request && query.isPending,
    page: request ? query.data : undefined,
    error: request && query.isError ? issueApprovalsError(query.error) : null,
    read: () => {
      if (available && isCurrent())
        setSelected({ token: session.token, id: ++sequence.current });
    },
  };
}
