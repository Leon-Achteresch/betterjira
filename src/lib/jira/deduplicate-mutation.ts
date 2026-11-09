import type { QueryClient } from "@tanstack/react-query";

const clients = new WeakMap<QueryClient, Map<string, Promise<unknown>>>();

export const deduplicateMutation = (client: QueryClient, key: string, run: () => Promise<unknown>) => {
  const pending = clients.get(client) ?? new Map<string, Promise<unknown>>();
  clients.set(client, pending);
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = run().finally(() => {
    if (pending.get(key) === promise) pending.delete(key);
  });
  pending.set(key, promise);
  return promise;
};
