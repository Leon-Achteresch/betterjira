import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import {
  addArticle,
  addTime,
  changeLink,
  changeTag,
  createTicket,
  updateTicket,
} from "@/lib/zammad/api";
import { encodeUploads } from "@/lib/zammad/attachments";
import { resolveTicket } from "@/lib/zammad/api";
import { ZammadError } from "@/lib/zammad/client";
import { zammadKeys } from "@/lib/zammad/keys";
import type {
  Article,
  ArticleInput,
  CreateTicketInput,
  Ticket,
  TicketPatch,
} from "@/lib/zammad/model";

export const useUpdateZammadTicket = (ticket: Ticket | undefined) => {
  const id = ticket?.id ?? 0;
  const client = useQueryClient();
  return useMutation({
    mutationKey: zammadKeys.ticket(id),
    scope: { id: `zammad-ticket-${id}` },
    mutationFn: (patch: TicketPatch) =>
      Effect.runPromise(
        ticket
          ? updateTicket(id, patch)
          : Effect.fail(
              new ZammadError({ message: "Ticket ist noch nicht geladen" }),
            ),
      ),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: zammadKeys.ticket(id) });
      const previous = client.getQueryData<Ticket>(zammadKeys.ticket(id));
      if (previous)
        client.setQueryData(zammadKeys.ticket(id), { ...previous, ...patch });
      return {
        previous,
        connection: client.getQueryData(zammadKeys.connection),
      };
    },
    onError: (error, _patch, context) => {
      if (
        context?.previous &&
        context.connection === client.getQueryData(zammadKeys.connection)
      )
        client.setQueryData(zammadKeys.ticket(id), context.previous);
      toast.error(error.message);
    },
    onSuccess: (value, _patch, context) => {
      if (context?.connection === client.getQueryData(zammadKeys.connection))
        client.setQueryData(zammadKeys.ticket(id), value);
    },
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: zammadKeys.ticket(id) }),
        client.invalidateQueries({ queryKey: zammadKeys.searches }),
        client.invalidateQueries({
          queryKey: zammadKeys.resolve(ticket?.number ?? ""),
        }),
      ]),
  });
};
export const useZammadWrite = (id: number) => {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: zammadKeys.ticket(id) }),
      client.invalidateQueries({ queryKey: zammadKeys.searches }),
    ]);
  const onError = (error: Error) => toast.error(error.message);
  const article = useMutation({
    mutationFn: (input: ArticleInput & { files?: readonly File[] }) =>
      Effect.runPromise(
        encodeUploads(input.files ?? []).pipe(
          Effect.flatMap((attachments) =>
            addArticle(id, {
              body: input.body,
              type: input.type,
              internal: input.internal,
              to: input.to,
              cc: input.cc,
              subject: input.subject,
              in_reply_to: input.in_reply_to,
              attachments,
            }),
          ),
        ),
      ),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: zammadKeys.articles(id) });
      const previous = client.getQueryData<readonly Article[]>(
        zammadKeys.articles(id),
      );
      const temporaryId = -Date.now();
      if (previous)
        client.setQueryData(zammadKeys.articles(id), [
          ...previous,
          {
            id: temporaryId,
            ticket_id: id,
            body: input.body,
            internal: input.internal,
            content_type: "text/plain",
            type: input.type,
            from: "Du · wird gesendet…",
            created_at: new Date().toISOString(),
            attachments: [],
          },
        ]);
      return {
        previous,
        temporaryId,
        connection: client.getQueryData(zammadKeys.connection),
      };
    },
    onSuccess: (article, _input, context) => {
      if (context?.connection !== client.getQueryData(zammadKeys.connection))
        return;
      client.setQueryData<readonly Article[]>(zammadKeys.articles(id), (rows) =>
        rows?.map((row) => (row.id === context?.temporaryId ? article : row)),
      );
      return refresh();
    },
    onError: (error, _input, context) => {
      if (
        context?.previous &&
        context.connection === client.getQueryData(zammadKeys.connection)
      )
        client.setQueryData(zammadKeys.articles(id), context.previous);
      onError(error);
    },
  });
  const tag = useMutation({
    mutationFn: ({ item, remove }: { item: string; remove: boolean }) =>
      Effect.runPromise(changeTag(id, item, remove)),
    onMutate: async ({ item, remove }) => {
      await client.cancelQueries({ queryKey: zammadKeys.tags(id) });
      const previous = client.getQueryData<{ tags: readonly string[] }>(
        zammadKeys.tags(id),
      );
      if (previous)
        client.setQueryData(zammadKeys.tags(id), {
          tags: remove
            ? previous.tags.filter((tag) => tag !== item)
            : [...new Set([...previous.tags, item])],
        });
      return {
        previous,
        connection: client.getQueryData(zammadKeys.connection),
      };
    },
    onError: (error, _input, context) => {
      if (
        context?.previous &&
        context.connection === client.getQueryData(zammadKeys.connection)
      )
        client.setQueryData(zammadKeys.tags(id), context.previous);
      onError(error);
    },
    onSuccess: (_data, { item, remove }) => {
      if (remove)
        toast("Tag entfernt", {
          action: {
            label: "Rückgängig",
            onClick: () => tag.mutate({ item, remove: false }),
          },
        });
      return refresh();
    },
  });
  const time = useMutation({
    mutationFn: (value: string) => Effect.runPromise(addTime(id, value)),
    onSuccess: refresh,
    onError,
  });
  const link = useMutation({
    mutationFn: ({
      target,
      number,
      type,
      remove,
    }: {
      target?: number;
      number?: string;
      type: string;
      remove: boolean;
    }) =>
      Effect.runPromise(
        (target
          ? Effect.succeed({ id: target, number: number ?? "" })
          : resolveTicket(number ?? "").pipe(
              Effect.map(({ id, number }) => ({ id, number })),
            )
        ).pipe(
          Effect.flatMap((ticket) =>
            ticket.id === id
              ? Effect.fail(
                  new ZammadError({
                    message:
                      "Ein Ticket kann nicht mit sich selbst verknüpft werden",
                  }),
                )
              : changeLink(id, ticket.id, ticket.number, type, remove),
          ),
        ),
      ),
    onSuccess: refresh,
    onError,
  });
  return { article, tag, time, link };
};
export const useCreateZammadTicket = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketInput) =>
      Effect.runPromise(createTicket(input)),
    onSuccess: async (ticket) => {
      client.setQueryData(zammadKeys.ticket(ticket.id), ticket);
      await client.invalidateQueries({ queryKey: zammadKeys.searches });
    },
  });
};
