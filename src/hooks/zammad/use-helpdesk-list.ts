import { useZammadPeople } from "./use-zammad-people";
import { personFromAddress, stateLabel } from "@/lib/zammad/people";
import { useState } from "react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { openZammad } from "@/lib/zammad/client";
import { ticketDate, ticketQuery } from "@/lib/zammad/presentation";
import {
  ticketOptions,
  useZammadTickets,
  useZammadUser,
} from "./use-zammad-queries";
import { useZammadConnection } from "./use-zammad-connection";

export const useHelpdeskList = () => {
  const connection = useZammadConnection();
  const me = useZammadUser();
  const client = useQueryClient();
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("open");
  const [debounced] = useDebouncedValue(text, { wait: 250 });
  const tickets = useZammadTickets(ticketQuery(debounced, filter, me.data?.id));
  const rows = tickets.data?.pages.flat() ?? [];
  const people = useZammadPeople(
    rows.flatMap((ticket) => [ticket.customer_id, ticket.owner_id]),
  );
  const open = () => {
    if (connection.data) openMutation.mutate(connection.data.baseUrl);
  };
  const openMutation = useOpenHelpdesk();
  return {
    connected: !!connection.data,
    loading: connection.isPending || (!!connection.data && tickets.isPending),
    error: connection.error?.message ?? tickets.error?.message,
    text,
    setText,
    filter,
    setFilter,
    tickets: rows.map((ticket) => ({
      ...ticket,
      customerPerson:
        people.get(ticket.customer_id) ??
        personFromAddress(ticket.customer ?? "", "Kunde"),
      ownerPerson: people.get(ticket.owner_id),
      stateLabel: stateLabel(ticket.state),
      updatedLabel: ticketDate(ticket.updated_at),
    })),
    hasMore: tickets.hasNextPage,
    loadingMore: tickets.isFetchingNextPage,
    refreshing: tickets.isFetching,
    onMore: () => void tickets.fetchNextPage(),
    onRefresh: () => void tickets.refetch(),
    onOpen: open,
    onPrefetch: (id: number) => void client.prefetchQuery(ticketOptions(id)),
  };
};
export const useOpenHelpdesk = () =>
  useMutation({
    mutationFn: (baseUrl: string) => Effect.runPromise(openZammad(baseUrl)),
  });
export type HelpdeskListModel = ReturnType<typeof useHelpdeskList>;
