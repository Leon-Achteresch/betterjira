import { useQueries, useQueryClient } from "@tanstack/react-query";
import { helpdeskReferences } from "@/lib/zammad/jira-links";
import type { JiraIssueDetail } from "@/lib/jira/queries";
import { useZammadConnection } from "./use-zammad-connection";
import { resolveOptions, ticketOptions } from "./use-zammad-queries";

export const useJiraHelpdesk = (issue?: JiraIssueDetail) => {
  const connection = useZammadConnection();
  const client = useQueryClient();
  const references = issue
    ? helpdeskReferences(issue.fields, issue.names, connection.data?.baseUrl)
    : [];
  const queries = useQueries({
    queries: references.map((reference) => ({
      ...(reference.number
        ? resolveOptions(reference.number)
        : ticketOptions(reference.id ?? 0)),
      enabled: !!connection.data && !!(reference.number || reference.id),
    })),
  });
  return references.map((reference, index) => {
    const query = queries[index];
    const ticket = query.data;
    return {
      key: reference.number ?? reference.url ?? String(reference.id),
      number: ticket?.number ?? reference.number,
      title: ticket?.title ?? "Verknüpftes Zammad-Ticket",
      id: ticket?.id,
      url: reference.url,
      state: ticket?.state,
      customer: ticket?.customer,
      loading: query.isFetching,
      connected: !!connection.data,
      error: query.error?.message ?? connection.error?.message,
      onPrefetch: () => {
        if (ticket) void client.prefetchQuery(ticketOptions(ticket.id));
      },
      onRetry: () => void query.refetch(),
    };
  });
};
export type JiraHelpdeskReference = ReturnType<typeof useJiraHelpdesk>[number];
