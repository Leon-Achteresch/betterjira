import { Effect, Schema } from "effect";
import { zammad, ZammadError } from "./client";
import {
  Article,
  Named,
  Ticket,
  TicketLinks,
  TimeEntry,
  User,
  type ArticleInput,
  type CreateTicketInput,
  type TicketPatch,
} from "./model";

export const PAGE_SIZE = 30;
export const getUser = (id: number) => zammad(`/users/${id}?expand=true`, User);
export const currentUser = () => zammad("/users/me", User);
export const searchTickets = (query: string, page = 1) =>
  zammad(
    `/tickets/search?${new URLSearchParams({ query, page: String(page), per_page: String(PAGE_SIZE), expand: "true", sort_by: "updated_at", order_by: "desc" })}`,
    Schema.Array(Ticket),
  );
export const getTicket = (id: number) =>
  zammad(`/tickets/${id}?expand=true`, Ticket);
export const resolveTicket = (number: string) =>
  /^\d+$/.test(number)
    ? searchTickets(`number:${number}`).pipe(
        Effect.flatMap((rows) => {
          const ticket = rows.find((row) => row.number === number);
          return ticket
            ? Effect.succeed(ticket)
            : Effect.fail(
                new ZammadError({
                  message: `Zammad-Ticket #${number} nicht gefunden oder kein Zugriff.`,
                  status: 404,
                }),
              );
        }),
      )
    : Effect.fail(new ZammadError({ message: "Ungültige Ticketnummer" }));
export const updateTicket = (id: number, patch: TicketPatch) =>
  zammad(`/tickets/${id}?expand=true`, Ticket, "PUT", patch);
export const createTicket = (input: CreateTicketInput) =>
  zammad("/tickets?expand=true", Ticket, "POST", {
    ...input,
    article: { ...input.article, content_type: "text/plain", sender: "Agent" },
  });
export const getArticles = (id: number) =>
  zammad(`/ticket_articles/by_ticket/${id}?expand=true`, Schema.Array(Article));
export const addArticle = (id: number, input: ArticleInput) =>
  zammad("/ticket_articles", Article, "POST", {
    ...input,
    ticket_id: id,
    content_type: "text/plain",
    sender: "Agent",
  });
export const getTags = (id: number) =>
  zammad(
    `/tags?object=Ticket&o_id=${id}`,
    Schema.Struct({ tags: Schema.Array(Schema.String) }),
  );
export const changeTag = (id: number, item: string, remove: boolean) =>
  zammad(
    `/tags/${remove ? "remove" : "add"}`,
    Schema.Unknown,
    remove ? "DELETE" : "POST",
    { object: "Ticket", o_id: id, item },
  );
export const getTimeEntries = (id: number) =>
  zammad(`/tickets/${id}/time_accountings`, Schema.Array(TimeEntry));
export const addTime = (id: number, time: string) =>
  zammad(`/tickets/${id}/time_accountings`, TimeEntry, "POST", {
    time_unit: time,
  });
export const getLinks = (id: number) =>
  zammad(`/links?link_object=Ticket&link_object_value=${id}`, TicketLinks);
export const changeLink = (
  id: number,
  target: number,
  number: string,
  type: string,
  remove: boolean,
) =>
  zammad(
    `/links/${remove ? "remove" : "add"}`,
    Schema.Unknown,
    remove ? "DELETE" : "POST",
    {
      link_type: type,
      link_object_source: "Ticket",
      ...(remove
        ? { link_object_source_value: target }
        : { link_object_source_number: number }),
      link_object_target: "Ticket",
      link_object_target_value: id,
    },
  );
export const getNamed = (
  resource: "ticket_states" | "ticket_priorities" | "groups" | "organizations",
) =>
  Effect.gen(function* () {
    const rows: Named[] = [];
    const seen = new Set<number>();
    for (let page = 1; ; page++) {
      const batch = yield* zammad(
        `/${resource}?per_page=100&page=${page}`,
        Schema.Array(Named),
      );
      const fresh = batch.filter((row) => !seen.has(row.id));
      for (const row of fresh) {
        seen.add(row.id);
        rows.push(row);
      }
      if (batch.length < 100 || !fresh.length) return rows;
    }
  });
export const searchUsers = (query: string) =>
  zammad(
    `/users/search?${new URLSearchParams({ query, per_page: "30", page: "1" })}`,
    Schema.Array(User),
  );
