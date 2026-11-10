import { clearZammadDrafts } from "./use-zammad-draft";
import { useZammadPeople } from "./use-zammad-people";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { connect, disconnect, readConnection } from "@/lib/zammad/client";
import { currentUser } from "@/lib/zammad/api";
import { zammadKeys } from "@/lib/zammad/keys";
import { normalizeBaseUrl, userLabel } from "@/lib/zammad/presentation";

export const useZammadConnection = () =>
  useQuery({
    queryKey: zammadKeys.connection,
    queryFn: ({ signal }) => Effect.runPromise(readConnection, { signal }),
    retry: false,
    staleTime: Infinity,
  });
export const useZammadSettings = () => {
  const queryClient = useQueryClient();
  const connection = useZammadConnection();
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [editing, setEditing] = useState(false);
  const me = useQuery({
    queryKey: zammadKeys.user,
    queryFn: ({ signal }) => Effect.runPromise(currentUser(), { signal }),
    enabled: !!connection.data,
    retry: false,
  });
  const people = useZammadPeople(me.data ? [me.data.id] : []);
  const save = useMutation({
    mutationFn: () =>
      Effect.runPromise(connect(normalizeBaseUrl(baseUrl) ?? baseUrl, token)),
    onSuccess: async (value) => {
      clearZammadDrafts();
      await queryClient.cancelQueries({ queryKey: zammadKeys.all });
      queryClient.removeQueries({
        queryKey: zammadKeys.all,
        predicate: (query) => query.queryKey[1] !== "connection",
      });
      queryClient.setQueryData(zammadKeys.connection, value);
      setToken("");
      setEditing(false);
    },
  });
  const remove = useMutation({
    mutationFn: () => Effect.runPromise(disconnect),
    onSuccess: async () => {
      clearZammadDrafts();
      await queryClient.cancelQueries({ queryKey: zammadKeys.all });
      queryClient.removeQueries({
        queryKey: zammadKeys.all,
        predicate: (query) => query.queryKey[1] !== "connection",
      });
      queryClient.setQueryData(zammadKeys.connection, null);
      setToken("");
      setEditing(false);
    },
  });
  return {
    connection: connection.data,
    loading: connection.isPending,
    error:
      connection.error?.message ??
      save.error?.message ??
      remove.error?.message ??
      me.error?.message,
    person: me.data ? people.get(me.data.id) : undefined,
    account: me.data ? userLabel(me.data) : undefined,
    baseUrl,
    setBaseUrl,
    token,
    setToken,
    editing,
    canSave: !!normalizeBaseUrl(baseUrl) && !!token.trim(),
    saving: save.isPending,
    removing: remove.isPending,
    onSave: () => save.mutate(),
    onDisconnect: () => remove.mutate(),
    onCheck: () => void me.refetch(),
    checking: me.isFetching,
    onEdit: () => {
      setBaseUrl(connection.data?.baseUrl ?? "");
      setEditing(true);
    },
    onCancel: () => {
      setToken("");
      setEditing(false);
      save.reset();
    },
  };
};
export type ZammadSettingsModel = ReturnType<typeof useZammadSettings>;
