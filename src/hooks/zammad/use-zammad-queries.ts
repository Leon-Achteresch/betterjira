import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { Effect } from "effect";
import { useDebouncedValue } from "@tanstack/react-pacer";
import {
  currentUser,
  getArticles,
  getLinks,
  getNamed,
  getTags,
  getTicket,
  getTimeEntries,
  PAGE_SIZE,
  resolveTicket,
  searchTickets,
  searchUsers,
} from "@/lib/zammad/api";
import { zammadKeys } from "@/lib/zammad/keys";
import { ZammadError } from "@/lib/zammad/client";
import { useZammadConnection } from "./use-zammad-connection";

const retry = (count: number, error: Error) =>
  count < 1 &&
  !(error instanceof ZammadError && error.status && error.status < 500);
export const ticketOptions = (id: number) =>
  queryOptions({
    queryKey: zammadKeys.ticket(id),
    queryFn: ({ signal }) => Effect.runPromise(getTicket(id), { signal }),
    retry,
  });
export const resolveOptions = (number: string) =>
  queryOptions({
    queryKey: zammadKeys.resolve(number),
    queryFn: ({ signal }) =>
      Effect.runPromise(resolveTicket(number), { signal }),
    retry,
  });
export const ticketsOptions = (query: string) =>
  infiniteQueryOptions({
    queryKey: zammadKeys.search(query),
    initialPageParam: 1,
    queryFn: ({ signal, pageParam }) =>
      Effect.runPromise(searchTickets(query, pageParam), { signal }),
    getNextPageParam: (rows, _pages, page) =>
      rows.length === PAGE_SIZE ? page + 1 : undefined,
    retry,
  });
export const useZammadTickets = (query: string) => {
  const connection = useZammadConnection();
  return useInfiniteQuery({
    ...ticketsOptions(query),
    enabled: !!connection.data,
  });
};
export const useZammadUser = () => {
  const connection = useZammadConnection();
  return useQuery({
    queryKey: zammadKeys.user,
    queryFn: ({ signal }) => Effect.runPromise(currentUser(), { signal }),
    enabled: !!connection.data,
    retry,
  });
};
export const useZammadTicket = (id: number) => {
  const connection = useZammadConnection();
  return useQuery({
    ...ticketOptions(id),
    enabled: !!connection.data && id > 0,
  });
};
export const useZammadUsers = (query: string) => {
  const [debounced] = useDebouncedValue(query, { wait: 250 });
  return useQuery({
    queryKey: zammadKeys.users(debounced),
    queryFn: ({ signal }) =>
      Effect.runPromise(searchUsers(debounced), { signal }),
    enabled: debounced.trim().length >= 2,
    retry,
  });
};
export const useZammadMetadata = (
  resource: Parameters<typeof getNamed>[0],
  enabled = true,
) =>
  useQuery({
    queryKey: zammadKeys.metadata(resource),
    queryFn: ({ signal }) => Effect.runPromise(getNamed(resource), { signal }),
    staleTime: 300_000,
    retry,
    enabled,
  });
export const useZammadArticles = (id: number) =>
  useQuery({
    queryKey: zammadKeys.articles(id),
    queryFn: ({ signal }) => Effect.runPromise(getArticles(id), { signal }),
    enabled: id > 0,
    retry,
  });
export const useZammadTags = (id: number) =>
  useQuery({
    queryKey: zammadKeys.tags(id),
    queryFn: ({ signal }) => Effect.runPromise(getTags(id), { signal }),
    enabled: id > 0,
    retry,
  });
export const useZammadTime = (id: number) =>
  useQuery({
    queryKey: zammadKeys.time(id),
    queryFn: ({ signal }) => Effect.runPromise(getTimeEntries(id), { signal }),
    enabled: id > 0,
    retry,
  });
export const useZammadLinks = (id: number) =>
  useQuery({
    queryKey: zammadKeys.links(id),
    queryFn: ({ signal }) => Effect.runPromise(getLinks(id), { signal }),
    enabled: id > 0,
    retry,
  });
