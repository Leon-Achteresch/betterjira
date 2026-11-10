import { describe, expect, it } from "vitest";
import { ticketPatch } from "./ticket-form";
import type { Ticket } from "./model";

const ticket: Ticket = {
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
  pending_time: null,
  note: "",
};
const form = () => {
  const data = new FormData();
  data.set("title", ticket.title);
  for (const key of [
    "group_id",
    "state_id",
    "priority_id",
    "owner_id",
    "customer_id",
  ] as const)
    data.set(key, String(ticket[key]));
  data.set("note", "");
  data.set("pending_time", "");
  return data;
};
describe("ticket edits", () => {
  it("sends no unchanged fields, preserving restricted attributes", () =>
    expect(ticketPatch(form(), ticket)).toEqual({}));
  it("sends only changed attributes and rejects invalid IDs", () => {
    const data = form();
    data.set("title", " Neuer Titel ");
    data.set("priority_id", "3");
    data.set("customer_id", "NaN");
    data.set("owner_id", "-1");
    expect(ticketPatch(data, ticket)).toEqual({
      title: "Neuer Titel",
      priority_id: 3,
    });
  });
  it("allows clearing a pending reminder", () =>
    expect(
      ticketPatch(form(), { ...ticket, pending_time: "2026-11-12T12:00:00Z" }),
    ).toEqual({ pending_time: null }));
});
