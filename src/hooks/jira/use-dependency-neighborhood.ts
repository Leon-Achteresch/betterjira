import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useContextSession } from "@/hooks/use-context-session";
import { DependencyContextChanged, readDependencyNeighborhood } from "@/lib/jira/dependency-neighborhood";
import { fetchLinkTypes, issueLinkActionKeys, type LinkChoice } from "@/lib/jira/issue-link-actions";
import { jiraKeys } from "@/lib/jira/keys";
import { multiLinkChoices } from "@/lib/jira/multi-ticket-links";
import { jiraQueryScopeMatches, type JiraQueryScope } from "@/lib/jira/query-scope";

type Request = { id: number; choice: LinkChoice };
type View = { context: string; open: boolean; selected: string; request?: Request; revision: number; changed: boolean };
const closedView = (context: string, changed = false): View => ({ context, open: false, selected: "", revision: 0, changed });

export function useDependencyNeighborhood(source: string, scope: JiraQueryScope | undefined, host: string) {
  const client = useQueryClient();
  const context = JSON.stringify([scope, host, source]);
  const instance = useId();
  const [stored, setView] = useState(() => closedView(context));
  const view = stored.context === context ? stored : { ...closedView(context, stored.open || stored.changed), revision: stored.revision };
  if (view !== stored) setView(view);
  const session = useContextSession(JSON.stringify([context, view.open, view.request?.id]));
  const siteMatches = () => jiraQueryScopeMatches(client, scope) &&
    client.getQueryData<{ siteUrl: string }>(jiraKeys.site)?.siteUrl === host;
  const types = useQuery({
    queryKey: issueLinkActionKeys.types(JSON.stringify([scope, host])),
    enabled: view.open && !!scope && !!host,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({ signal }) => scope && host
      ? Effect.runPromise(fetchLinkTypes({ cloudId: scope.cloudId, siteUrl: host, isCurrent: siteMatches }), { signal })
      : Effect.runPromise(Effect.fail(new DependencyContextChanged()), { signal }),
  });
  const choices = multiLinkChoices(types.data ?? []).filter(({ type }) => type.inward !== type.outward);
  const choice = choices.find(({ id }) => id === view.selected);
  const request = view.request;
  const neighborhood = useQuery({
    queryKey: jiraKeys.dependencyNeighborhood(context, instance, request?.id),
    enabled: !!scope && !!host && view.open && !!request,
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({ signal }) => Effect.runPromise(
      scope && request && host
        ? readDependencyNeighborhood(source, { typeId: request.choice.type.id, direction: request.choice.direction }, {
          cloudId: scope.cloudId, siteUrl: host, isCurrent: () => session.isCurrent() && siteMatches(),
        })
        : Effect.fail(new DependencyContextChanged()), { signal },
    ),
  });
  const loading = !!request && neighborhood.isPending;

  return {
    source,
    open: view.open,
    changed: view.changed,
    setOpen: (open: boolean) => setView((current) => current.context === context
      ? { ...current, open, changed: false, request: open ? current.request : undefined }
      : current),
    available: !!scope && !!host,
    choices,
    selected: view.selected,
    select: (selected: string) => setView((current) => current.context === context
      ? { ...current, selected, request: undefined }
      : current),
    metadataLoading: types.isPending,
    metadataError: types.isError,
    retryMetadata: () => { void types.refetch(); },
    canLoad: !!choice && types.isSuccess && !loading,
    load: () => {
      if (!view.open || !choice || !types.isSuccess || loading || !siteMatches()) return;
      setView((current) => current.context === context && current.open && current.selected === choice.id
        ? { ...current, revision: current.revision + 1, request: { id: current.revision + 1, choice } }
        : current);
    },
    loading,
    error: neighborhood.error,
    result: request && neighborhood.data ? { ...neighborhood.data, choice: request.choice, id: request.id } : undefined,
  };
}

export type DependencyNeighborhoodState = ReturnType<typeof useDependencyNeighborhood>;
