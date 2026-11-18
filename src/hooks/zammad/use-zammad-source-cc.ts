import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useId, useRef, useState } from "react";
import { useContextSession } from "@/hooks/use-context-session";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { getArticles } from "@/lib/zammad/api";
import { readConnection, ZammadError } from "@/lib/zammad/client";
import { zammadKeys } from "@/lib/zammad/keys";
import type { Article, Connection, User } from "@/lib/zammad/model";
import {
  findSourceCcArticle,
  sourceCcAddresses,
  sourceCcIdentity,
} from "@/lib/zammad/source-cc";

const contextChanged = () =>
  new ZammadError({
    message: "Quelle oder Verbindung wurde geändert. Bitte erneut prüfen.",
  });

function checkConnection(expected: Required<Connection>) {
  return readConnection.pipe(
    Effect.flatMap((actual) =>
      actual?.baseUrl === expected.baseUrl &&
      actual.revision === expected.revision
        ? Effect.void
        : Effect.fail(contextChanged()),
    ),
  );
}

export function useZammadSourceCc({
  ticketId,
  reply,
  articles,
  connection,
  userId,
  addCc,
}: {
  ticketId: number;
  reply: Article | null;
  articles: readonly Article[];
  connection: Connection | null | undefined;
  userId: number | undefined;
  addCc: (reply: Article, addresses: readonly string[]) => boolean;
}) {
  const client = useQueryClient();
  const instance = useId();
  const request = useRef(0);
  const identity = reply ? sourceCcIdentity(reply, ticketId) : null;
  const scope = JSON.stringify([
    connection?.baseUrl,
    connection?.revision,
    userId,
    ticketId,
    identity,
  ]);
  const session = useContextSession(scope);
  const latestReply = useLatestRef(reply);
  const source =
    reply && identity
      ? findSourceCcArticle(articles, ticketId, reply.id, identity)
      : undefined;
  const [panel, setPanel] = useState<{
    token: typeof session.token;
    source: Article;
    request: number;
    checked: readonly string[];
  } | null>(null);
  const currentPanel = panel?.token === session.token ? panel : null;
  const latestPanel = useLatestRef(currentPanel);
  const requestScope = connection?.revision
    ? { baseUrl: connection.baseUrl, revision: connection.revision }
    : null;
  const available = !!(source && userId && requestScope);
  const isCurrent = () =>
    available &&
    session.isCurrent() &&
    latestReply.current === reply &&
    client.getQueryData<Connection | null>(zammadKeys.connection) ===
      connection &&
    client.getQueryData<User>(zammadKeys.user)?.id === userId &&
    client.getQueryState(zammadKeys.user)?.status === "success" &&
    findSourceCcArticle(
      client.getQueryData<readonly Article[]>(zammadKeys.articles(ticketId)) ??
        [],
      ticketId,
      reply?.id ?? 0,
      identity ?? "",
    ) === source;
  const isPanelCurrent = () =>
    !!currentPanel &&
    currentPanel.source === source &&
    latestPanel.current?.request === currentPanel.request &&
    isCurrent();
  const queryKey = zammadKeys.ccSource(
    scope,
    `${instance}:${currentPanel?.request ?? 0}`,
  );
  const query = useQuery({
    queryKey,
    enabled: !!currentPanel && available,
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          if (!requestScope || !reply || !identity || !isPanelCurrent())
            return yield* contextChanged();
          const rows = yield* getArticles(ticketId, requestScope);
          yield* checkConnection(requestScope);
          const fresh = findSourceCcArticle(rows, ticketId, reply.id, identity);
          if (!fresh || !isPanelCurrent()) return yield* contextChanged();
          return sourceCcAddresses(fresh.cc);
        }),
        { signal },
      ),
  });
  const apply = useMutation({
    mutationFn: async ({
      expected,
      selected,
    }: {
      expected: Required<Connection>;
      selected: readonly string[];
    }) => {
      const valid = await Effect.runPromise(
        Effect.isSuccess(checkConnection(expected)),
      );
      if (
        !valid ||
        !reply ||
        !isPanelCurrent() ||
        client.getQueryData(queryKey) !== query.data
      )
        return "expired" as const;
      return addCc(reply, selected)
        ? ("inserted" as const)
        : ("invalid-draft" as const);
    },
  });
  const expired = !isPanelCurrent() || apply.data === "expired";
  const addresses = expired ? [] : (query.data ?? []);
  const error = !currentPanel
    ? null
    : expired
      ? contextChanged().message
      : (query.error?.message ??
        (apply.data === "invalid-draft"
          ? "Bitte prüfe die Adressen im CC-Feld, bevor du weitere hinzufügst."
          : null));
  return {
    available,
    open: !!currentPanel && available,
    addresses,
    checked: currentPanel?.checked ?? [],
    loading: query.isLoading,
    checking: apply.isPending,
    error,
    setOpen: (open: boolean) => {
      apply.reset();
      if (!open) setPanel(null);
      else if (source && isCurrent())
        setPanel({
          token: session.token,
          source,
          request: ++request.current,
          checked: [],
        });
    },
    toggle: (address: string) => {
      if (!currentPanel || !addresses.includes(address) || apply.isPending)
        return;
      setPanel({
        ...currentPanel,
        checked: currentPanel.checked.includes(address)
          ? currentPanel.checked.filter((item) => item !== address)
          : [...currentPanel.checked, address],
      });
    },
    insert: () => {
      if (
        !currentPanel?.checked.length ||
        !requestScope ||
        !query.data ||
        !isPanelCurrent() ||
        apply.isPending
      )
        return;
      const selected = addresses.filter((address) =>
        currentPanel.checked.includes(address),
      );
      if (!selected.length) return;
      apply.mutate(
        { expected: requestScope, selected },
        {
          onSuccess: (status) => {
            if (status === "inserted" && isPanelCurrent()) setPanel(null);
          },
        },
      );
    },
  };
}

export type ZammadSourceCcModel = ReturnType<typeof useZammadSourceCc>;
