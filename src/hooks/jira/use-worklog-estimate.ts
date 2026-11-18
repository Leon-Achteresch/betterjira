import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useContextSession } from "@/hooks/use-context-session";
import { jiraKeys } from "@/lib/jira/keys";
import { jiraQueryScopeMatches } from "@/lib/jira/query-scope";
import {
  normalizeRemainingEstimate,
  type WorklogBooking,
} from "@/lib/jira/worklog";
import { worklogEstimateAllowed } from "@/lib/jira/worklog-estimate-capability";
import { useJiraMyself, useJiraSite } from "./use-jira";

export function useWorklogEstimate(
  issueKey: string,
  issueId: string | undefined,
) {
  const client = useQueryClient();
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
    issueId &&
    scope &&
    host &&
    worklogEstimateAllowed(scope, host)
  );
  const session = useContextSession(
    JSON.stringify([issueKey, issueId, scope, host, available]),
  );
  const [draft, setDraft] = useState<{
    token: typeof session.token;
    value: string;
  }>();
  const selected =
    available && draft?.token === session.token ? draft : undefined;
  const isCurrent = () =>
    session.isCurrent() &&
    jiraQueryScopeMatches(client, scope) &&
    client.getQueryData<{ siteUrl: string }>(jiraKeys.site)?.siteUrl === host;
  const value = selected
    ? normalizeRemainingEstimate(selected.value)
    : undefined;

  return {
    available,
    selected: !!selected,
    input: selected?.value ?? "",
    value,
    setInput: (input: string) => {
      if (available && isCurrent())
        setDraft({ token: session.token, value: input });
    },
    clear: () => setDraft(undefined),
    matchesTarget: (
      booking: NonNullable<WorklogBooking["remainingEstimate"]>,
    ) =>
      booking.issueId === issueId &&
      booking.scope.siteUrl === host &&
      booking.scope.cloudId === site.data?.cloudId &&
      booking.scope.accountId === account.data?.accountId,
    confirmed(onDispatch: () => void): WorklogBooking["remainingEstimate"] {
      if (!available || !value || !issueId || !scope || !host || !isCurrent())
        return undefined;
      return {
        value,
        issueId,
        scope: { ...scope, siteUrl: host, isCurrent, onDispatch },
      };
    },
  };
}
