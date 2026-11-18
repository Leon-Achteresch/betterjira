import { useId, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useContextSession } from "@/hooks/use-context-session";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { getArticles } from "@/lib/zammad/api";
import { ZammadError } from "@/lib/zammad/client";
import { zammadKeys } from "@/lib/zammad/keys";
import type { Article, User } from "@/lib/zammad/model";
import { sourceFingerprint, sourceQuote } from "@/lib/zammad/source-quote";
import { useZammadConnection } from "./use-zammad-connection";
import { useZammadUser } from "./use-zammad-queries";
import { useZammadDraft } from "./use-zammad-draft";

export function useZammadSourceQuote(
  ticketId: number,
  articles: readonly Article[],
) {
  const connection = useZammadConnection();
  const user = useZammadUser();
  const client = useQueryClient();
  const instance = useId();
  const scope = JSON.stringify([
    connection.data?.baseUrl,
    user.data?.id,
    ticketId,
  ]);
  const context = useMemo(
    () => ({ scope, connection: connection.data, userId: user.data?.id }),
    [scope, connection.data, user.data?.id],
  );
  const requestScope = connection.data?.revision
    ? { baseUrl: connection.data.baseUrl, revision: connection.data.revision }
    : undefined;
  const session = useContextSession(scope);
  const latestContext = useLatestRef(context);
  const latestArticles = useLatestRef(articles);
  const draft = useZammadDraft(`source-quote:${scope}`);
  const [editor, setEditor] = useState({ context, active: false });
  const active = editor.context === context && editor.active;
  const latestEditor = useLatestRef(editor);
  const [selection, setSelection] = useState<{
    context: typeof context;
    id: number;
    fingerprint: string;
    article: Article;
    request: number;
  } | null>(null);
  const latestSelection = useLatestRef(selection);
  const [sequence, setSequence] = useState(0);
  const selected = selection?.context === context ? selection : null;
  const contextCurrent = () =>
    session.isCurrent() &&
    latestContext.current === context &&
    !!context.connection &&
    ticketId > 0 &&
    client.getQueryData(zammadKeys.connection) === context.connection &&
    client.getQueryData<User>(zammadKeys.user)?.id === context.userId;
  const current = () => contextCurrent() && !!context.userId;
  const sourceCurrent = () =>
    current() &&
    !!selected &&
    latestSelection.current === selected &&
    latestArticles.current.some(
      (article) =>
        article.id === selected.id &&
        article === selected.article &&
        article.ticket_id === ticketId &&
        sourceFingerprint(article) === selected.fingerprint,
    );
  const queryKey = zammadKeys.quoteSource(
    scope,
    `${instance}:${selected?.request ?? 0}`,
    selected?.id ?? 0,
  );
  const query = useQuery({
    queryKey,
    enabled: !!selected && current() && !!requestScope,
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({ signal }) =>
      Effect.runPromise(
        Effect.suspend(() =>
          sourceCurrent()
            ? getArticles(ticketId, requestScope).pipe(
                Effect.flatMap((rows) => {
                  const matches = rows.filter(
                    (row) =>
                      row.id === selected?.id && row.ticket_id === ticketId,
                  );
                  const source = matches.length === 1 ? matches[0] : undefined;
                  return source && sourceCurrent()
                    ? Effect.succeed(source)
                    : Effect.fail(
                        new ZammadError({
                          message:
                            "Quelle nicht mehr verfügbar. Bitte erneut auswählen.",
                        }),
                      );
                }),
              )
            : Effect.fail(
                new ZammadError({
                  message:
                    "Ticket oder Konto wurde gewechselt. Bitte erneut auswählen.",
                }),
              ),
        ),
        { signal },
      ),
  });
  const preview = useMemo(
    () => (query.data ? sourceQuote(query.data) : null),
    [query.data],
  );
  const valid = sourceCurrent();
  const open = (sourceId: number) => {
    if (!current() || !requestScope || latestArticles.current !== articles)
      return;
    const article = latestArticles.current.find(
      (row) =>
        row.id === sourceId &&
        row.ticket_id === ticketId &&
        Number.isSafeInteger(row.id) &&
        row.id > 0,
    );
    if (!article) return;
    const next = sequence + 1;
    setSequence(next);
    setSelection({
      context,
      id: article.id,
      fingerprint: sourceFingerprint(article),
      article,
      request: next,
    });
  };
  const close = () => {
    if (current() && latestSelection.current === selection) setSelection(null);
  };
  const resume = () => {
    if (current() && requestScope && draft.body.trim())
      setEditor({ context, active: true });
  };
  const isEditorCurrent = () =>
    current() && active && latestEditor.current === editor;
  return {
    available: current() && !!requestScope,
    requestScope,
    active,
    hasDraft: !!draft.body.trim(),
    selectedId: selected?.id,
    preview: valid ? preview : null,
    loading: !!selected && query.isPending,
    error:
      selected && !valid
        ? "Quelle oder Kontext wurde geändert. Bitte schließen und erneut auswählen."
        : (query.error?.message ??
          (query.data && !preview
            ? "Diese Quelle enthält keinen sicher übernehmbaren Text. Bitte bei Bedarf manuell kopieren."
            : null)),
    alreadyIncluded: !!selected && draft.quotedSources.includes(selected.id),
    open,
    close,
    resume,
    leave: () => {
      if (current() && latestEditor.current === editor)
        setEditor({ context, active: false });
    },
    insert: () => {
      if (
        !sourceCurrent() ||
        !preview ||
        !query.data ||
        client.getQueryData(queryKey) !== query.data
      )
        return;
      draft.quote(query.data.id, preview.block);
      setEditor({ context, active: true });
      setSelection(null);
    },
    draft,
    update: (patch: Parameters<typeof draft.update>[0]) => {
      if (isEditorCurrent())
        draft.update({
          ...patch,
          ...(patch.body !== undefined && !patch.body.trim()
            ? { quotedSources: [] }
            : {}),
          kind: "internal",
          reply: null,
          recipient: null,
          cc: "",
        });
    },
    complete: () => {
      if (isEditorCurrent()) draft.complete();
    },
    isEditorCurrent,
    isComposerCurrent: () =>
      contextCurrent() &&
      latestEditor.current === editor &&
      (!active || !!requestScope),
  };
}
