import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useContextSession } from "@/hooks/use-context-session";
import { useLatestRef } from "@/hooks/use-latest-ref";
import {
  JiraRequestScopeChanged,
  type JiraRequestScope,
} from "@/lib/jira/client";
import type { IssueLinkReference } from "@/lib/jira/issue-links";
import { jiraKeys } from "@/lib/jira/keys";
import {
  jiraQueryScopeMatches,
  type JiraQueryScope,
} from "@/lib/jira/query-scope";

export type IssueLinkPreviewContext = {
  source: string;
  scope?: JiraQueryScope;
  host: string;
};

type PreviewContract<T, E> = {
  eligible: boolean;
  key: (
    context: string,
    instance: string,
    request: number | undefined,
  ) => readonly unknown[];
  read: (
    source: string,
    target: string,
    reference: IssueLinkReference,
    accountId: string,
    scope: JiraRequestScope,
  ) => Effect.Effect<T, E>;
  error: (error: unknown) => string;
};

export function useIssueLinkPreview<T, E>(
  { source, scope, host }: IssueLinkPreviewContext,
  target: string,
  reference: IssueLinkReference,
  contract: PreviewContract<T, E>,
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
    reference.typeName,
    reference.directed,
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
    contract.eligible &&
    source.toUpperCase() !== target.toUpperCase()
  );
  const query = useQuery({
    queryKey: contract.key(context, instance, request?.id),
    enabled: available && !!request,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({ signal }) => {
      if (!scope || !request) throw new JiraRequestScopeChanged();
      return Effect.runPromise(
        contract.read(source, target, reference, scope.accountId, {
          cloudId: scope.cloudId,
          siteUrl: host,
          isCurrent: () => current() && latest.current === request,
        }),
        { signal },
      );
    },
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
    error: request && query.isError ? contract.error(query.error) : null,
    setOpen: (open: boolean) => {
      if (open) start();
      else setRequest(null);
    },
    retry: start,
  };
}
