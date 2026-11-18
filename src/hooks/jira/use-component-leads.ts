import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { useLatestRef } from "../use-latest-ref";
import { componentLeadsQuery, selectedComponents, type ComponentProject } from "@/lib/jira/component-leads";

export function useComponentLeads(input: { selection: unknown; project?: ComponentProject; context: string }) {
  const client = useQueryClient();
  const site = useJiraSite(); const myself = useJiraMyself();
  const scope = site.isSuccess && site.data && myself.isSuccess && myself.data ? { cloudId: site.data.cloudId, accountId: myself.data.accountId } : undefined;
  const selection = selectedComponents(input.selection);
  const context = JSON.stringify([scope, input.project, input.context, selection]);
  const [state, setState] = useState({ context, token: Symbol(), open: false });
  const current = state.context === context ? state : { context, token: Symbol(), open: false };
  if (current !== state) setState(current);
  const latest = useLatestRef(current);
  const open = current.open;
  const query = useQuery({
    ...componentLeadsQuery(client, scope, input.project, selection.components),
    enabled: open && !!scope && !!input.project?.key && selection.components.length > 0,
  });
  const byId = new Map((query.isError ? [] : query.data ?? []).map((contact) => [contact.id, contact]));
  return {
    visible: selection.components.length > 0 || selection.invalid > 0,
    open,
    setOpen: (value: boolean) => { if (latest.current.token === current.token) setState((previous) => ({ ...previous, open: value })); },
    disabled: !scope || !input.project?.key,
    projectLabel: input.project?.key ?? "Projekt noch nicht bestätigt",
    loading: open && selection.components.length > 0 && query.isPending,
    error: query.isError ? "Rollen konnten für dieses Konto nicht geprüft werden." : undefined,
    invalid: selection.invalid,
    rows: selection.components.map((component) => byId.get(component.id) ?? { id: component.id, name: component.name ?? component.id, status: "unavailable" as const, message: "Rollenhinweis noch nicht geladen." }),
    refreshing: query.isFetching,
    canRefresh: open && !!scope && !!input.project?.key && selection.components.length > 0 && !query.isFetching,
    refresh: () => { if (latest.current.token === current.token && open && scope && input.project?.key && selection.components.length > 0) void query.refetch({ cancelRefetch: false }); },
  };
}
export type ComponentLeadsState = ReturnType<typeof useComponentLeads>;
