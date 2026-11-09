import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { searchTickets } from "@/lib/zammad/api";
import { ticketQuery } from "@/lib/zammad/presentation";
import { zammadKeys } from "@/lib/zammad/keys";
import { useZammadConnection } from "./use-zammad-connection";

export const useHelpdeskCommandSearch = (text: string, enabled: boolean) => {
  const connection = useZammadConnection();
  return useQuery({
    queryKey: zammadKeys.commandSearch(text),
    queryFn: ({ signal }) =>
      Effect.runPromise(searchTickets(ticketQuery(text, "all")), { signal }),
    enabled: enabled && text.trim().length >= 2 && !!connection.data,
    retry: false,
    select: (tickets) => tickets.slice(0, 6),
  });
};
