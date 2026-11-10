import { Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
import { connect, readConnection, zammad } from "./client";
import {
  addArticle,
  addTime,
  changeLink,
  changeTag,
  createTicket,
  getArticles,
  getLinks,
  getNamed,
  getTicket,
  resolveTicket,
  searchTickets,
  updateTicket,
} from "./api";

const ticket = {
  id: 41,
  number: "20043776",
  title: "Kundenportal",
  group_id: 1,
  state_id: 2,
  priority_id: 2,
  owner_id: 3,
  customer_id: 7,
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-09T09:00:00Z",
};
const ok = (body: unknown, status = 200) => ({
  status,
  body: JSON.stringify(body),
});
beforeEach(() => invoke.mockReset());

describe("Zammad transport", () => {
  it("reads only public connection data and never sends a token in ticket requests", async () => {
    invoke.mockResolvedValueOnce({
      baseUrl: "https://support.example.com",
      token: "must-not-leak",
    });
    expect(await Effect.runPromise(readConnection)).toEqual({
      baseUrl: "https://support.example.com",
    });
    invoke.mockResolvedValueOnce(ok(ticket));
    await Effect.runPromise(getTicket(41));
    expect(invoke).toHaveBeenLastCalledWith("zammad_request", {
      path: "/tickets/41?expand=true",
      method: "GET",
      body: null,
    });
  });
  it.each([401, 403, 404, 429, 500])(
    "keeps status %s as a tagged failure without exposing response content",
    async (status) => {
      invoke.mockResolvedValueOnce({
        status,
        body: "secret token from error body",
      });
      const error = await Effect.runPromise(
        zammad("/tickets", Schema.Unknown),
      ).catch((error: unknown) => error);
      expect(error).toMatchObject({ _tag: "ZammadError", status });
      expect(String(error)).not.toContain("secret token");
      expect(invoke).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects malformed JSON, response envelopes and schema-invalid tickets", async () => {
    for (const value of [
      { status: 200, body: "<html>login</html>" },
      { status: 200, body: "{}" },
      { status: "200", body: "{}" },
    ]) {
      invoke.mockResolvedValueOnce(value);
      await expect(Effect.runPromise(getTicket(41))).rejects.toMatchObject({
        _tag: "ZammadError",
      });
    }
  });
  it("supports empty successful write responses", async () => {
    invoke.mockResolvedValueOnce({ status: 204, body: "" });
    await expect(
      Effect.runPromise(changeTag(41, "done", true)),
    ).resolves.toBeNull();
  });
  it("passes connection credentials exclusively to the native connect command", async () => {
    invoke.mockResolvedValueOnce({ baseUrl: "https://support.example.com" });
    await Effect.runPromise(
      connect("https://support.example.com", "test-token"),
    );
    expect(invoke).toHaveBeenCalledExactlyOnceWith("zammad_connect", {
      baseUrl: "https://support.example.com",
      token: "test-token",
    });
  });
  it("interrupts the effect when a query signal is aborted", async () => {
    invoke.mockImplementationOnce(() => new Promise(() => {}));
    const controller = new AbortController();
    const pending = Effect.runPromise(getTicket(41), {
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toBeDefined();
  });
});

describe("documented Zammad API contracts", () => {
  it("resolves public numbers by exact match, never by treating them as IDs", async () => {
    invoke.mockResolvedValueOnce(
      ok([{ ...ticket, number: "200437760" }, ticket]),
    );
    expect((await Effect.runPromise(resolveTicket("20043776"))).id).toBe(41);
    const args = invoke.mock.calls[0][1];
    expect(
      new URL(args.path, "https://mock.invalid").searchParams.get("query"),
    ).toBe("number:20043776");
    invoke.mockResolvedValueOnce(ok([{ ...ticket, number: "200437760" }]));
    await expect(
      Effect.runPromise(resolveTicket("20043776")),
    ).rejects.toMatchObject({ status: 404 });
    const calls = invoke.mock.calls.length;
    await expect(
      Effect.runPromise(resolveTicket("* OR owner_id:1")),
    ).rejects.toMatchObject({ _tag: "ZammadError" });
    expect(invoke).toHaveBeenCalledTimes(calls);
  });
  it("encodes queries and paginates with server ordering", async () => {
    invoke.mockResolvedValueOnce(ok([]));
    await Effect.runPromise(searchTickets("title:Kunde & state:open", 3));
    const params = new URL(invoke.mock.calls[0][1].path, "https://mock.invalid")
      .searchParams;
    expect(Object.fromEntries(params)).toMatchObject({
      query: "title:Kunde & state:open",
      page: "3",
      per_page: "30",
      expand: "true",
      sort_by: "updated_at",
      order_by: "desc",
    });
  });
  it("updates tickets with PUT and fetches articles from the by_ticket endpoint", async () => {
    invoke.mockResolvedValueOnce(ok(ticket)).mockResolvedValueOnce(ok([]));
    await Effect.runPromise(
      updateTicket(41, { state_id: 4, pending_time: null }),
    );
    expect(invoke.mock.calls[0][1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ state_id: 4, pending_time: null }),
    });
    await Effect.runPromise(getArticles(41));
    expect(invoke.mock.calls[1][1].path).toBe(
      "/ticket_articles/by_ticket/41?expand=true",
    );
  });
  it("sends explicit agent identity, visibility, plain-text content and attachment data", async () => {
    invoke.mockResolvedValueOnce(
      ok({
        id: 9,
        ticket_id: 41,
        body: "Notiz",
        internal: true,
        created_at: ticket.created_at,
      }),
    );
    const attachments = [
      { filename: "test.txt", data: "aGk=", "mime-type": "text/plain" },
    ];
    await Effect.runPromise(
      addArticle(41, {
        body: "Notiz",
        type: "note",
        internal: true,
        attachments,
      }),
    );
    expect(JSON.parse(invoke.mock.calls[0][1].body)).toEqual({
      ticket_id: 41,
      sender: "Agent",
      content_type: "text/plain",
      body: "Notiz",
      type: "note",
      internal: true,
      attachments,
    });
  });
  it("creates a ticket with an initial article", async () => {
    invoke.mockResolvedValueOnce(ok(ticket, 201));
    await Effect.runPromise(
      createTicket({
        title: "Kundenportal",
        group_id: 1,
        customer_id: 7,
        article: { body: "Beschreibung", type: "note", internal: false },
      }),
    );
    expect(JSON.parse(invoke.mock.calls[0][1].body).article).toMatchObject({
      sender: "Agent",
      content_type: "text/plain",
      internal: false,
    });
  });
  it("uses links/add with the source NUMBER and target ID", async () => {
    invoke
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ links: [] }));
    await Effect.runPromise(changeLink(41, 42, "20043777", "normal", false));
    expect(invoke.mock.calls[0][1]).toMatchObject({
      path: "/links/add",
      method: "POST",
    });
    expect(JSON.parse(invoke.mock.calls[0][1].body)).toMatchObject({
      link_object_source_number: "20043777",
      link_object_target_value: 41,
    });
    await Effect.runPromise(getLinks(41));
    expect(invoke.mock.calls[1][1].path).toBe(
      "/links?link_object=Ticket&link_object_value=41",
    );
  });
  it("keeps time units in the instance's units", async () => {
    invoke.mockResolvedValueOnce(
      ok({
        id: 1,
        ticket_id: 41,
        time_unit: "1.5",
        created_at: ticket.created_at,
      }),
    );
    await Effect.runPromise(addTime(41, "1.5"));
    expect(invoke.mock.calls[0][1]).toMatchObject({
      path: "/tickets/41/time_accountings",
      method: "POST",
      body: JSON.stringify({ time_unit: "1.5" }),
    });
  });
});

it("paginates metadata and stops if the server ignores pagination", async () => {
  const batch = Array.from({ length: 100 }, (_, id) => ({
    id: id + 1,
    name: `Group ${id + 1}`,
  }));
  invoke
    .mockResolvedValueOnce(ok(batch))
    .mockResolvedValueOnce(ok([{ id: 101, name: "Last group" }]));
  expect(await Effect.runPromise(getNamed("groups"))).toHaveLength(101);
  expect(invoke.mock.calls[1][1].path).toContain("page=2");
  invoke.mockReset();
  invoke.mockResolvedValue(ok(batch));
  expect(await Effect.runPromise(getNamed("groups"))).toHaveLength(100);
  expect(invoke).toHaveBeenCalledTimes(2);
});
