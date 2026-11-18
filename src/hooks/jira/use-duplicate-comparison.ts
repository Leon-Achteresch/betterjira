import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useContextSession } from "@/hooks/use-context-session";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { JiraRequestScopeChanged } from "@/lib/jira/client";
import {
  duplicateComparisonError,
  readDuplicateComparison,
} from "@/lib/jira/duplicate-comparison";
import type { IssueLinkReference } from "@/lib/jira/issue-links";
import { jiraKeys } from "@/lib/jira/keys";
import {
  jiraQueryScopeMatches,
  type JiraQueryScope,
} from "@/lib/jira/query-scope";

export type DuplicateComparisonContext = {
  source: string;
  scope?: JiraQueryScope;
  host: string;
};

export function useDuplicateComparison(
  { source, scope, host }: DuplicateComparisonContext,
  target: string,
  reference: IssueLinkReference,
) {
  const client = useQueryClient();
  const instance = useId();
  const context = JSON.stringify([
    scope,
    host,
    source,
    target,
    reference.id,
    reference.typeId,
    reference.direction,
  ]);
  const session = useContextSession(context);
  const sequence = useRef(0);
  const [stored, setRequest] = useState<{
    token: typeof session.token;
    id: number;
  } | null>(null);
  const request = stored?.token === session.token ? stored : null;
  const latest = useLatestRef(request);
  const current = () =>
    session.isCurrent() &&
    jiraQueryScopeMatches(client, scope) &&
    client.getQueryData<{ siteUrl: string }>(jiraKeys.site)?.siteUrl === host;
  const available = !!(
    scope &&
    host &&
    reference.duplicate &&
    source.toUpperCase() !== target.toUpperCase()
  );
  const query = useQuery({
    queryKey: jiraKeys.duplicateComparison(context, instance, request?.id),
    enabled: available && !!request,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({ signal }) =>
      Effect.runPromise(
        scope && request
          ? readDuplicateComparison(
              source,
              target,
              reference,
              scope.accountId,
              {
                cloudId: scope.cloudId,
                siteUrl: host,
                isCurrent: () => current() && latest.current === request,
              },
            )
          : Effect.fail(new JiraRequestScopeChanged()),
        { signal },
      ),
  });
  const start = () => {
    if (available && current())
      setRequest({ token: session.token, id: ++sequence.current });
  };
  return {
    context,
    available,
    open: available && !!request,
    loading: !!request && query.isPending,
    result: request ? query.data : undefined,
    error:
      request && query.isError ? duplicateComparisonError(query.error) : null,
    setOpen: (open: boolean) => {
      if (open) start();
      else setRequest(null);
    },
    retry: start,
  };
}
