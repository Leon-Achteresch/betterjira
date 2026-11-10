import type { Ticket, TicketPatch } from "./model";

export const formText = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
export const ticketPatch = (form: FormData, ticket: Ticket): TicketPatch => {
  const patch: TicketPatch = {};
  const title = formText(form, "title");
  if (title && title !== ticket.title) patch.title = title;
  for (const key of [
    "group_id",
    "state_id",
    "priority_id",
    "owner_id",
    "customer_id",
  ] as const) {
    const value = Number(formText(form, key));
    if (Number.isSafeInteger(value) && value > 0 && value !== ticket[key])
      patch[key] = value;
  }
  const pending = formText(form, "pending_time");
  const pendingTime = pending ? new Date(pending).toISOString() : null;
  if (pendingTime !== (ticket.pending_time ?? null))
    patch.pending_time = pendingTime;
  const note = formText(form, "note");
  if (note !== (ticket.note ?? "")) patch.note = note;
  return patch;
};
export const localDateInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};
