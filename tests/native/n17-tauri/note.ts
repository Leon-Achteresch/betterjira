export const ticketTitle = "Anmeldung am Kundenportal nicht möglich";
export const articleText = "Seit heute kann ich mich nicht mehr am Kundenportal anmelden.";
export const articleFrom = "Sam Kunde <sam@example.test>";
export const articleTime = "2026-11-09T09:00:00Z";
export const quote = `Zitat von ${articleFrom} · ${articleTime}\n> ${articleText}`;
export const expectedNote = {
  ticket_id: 41,
  internal: true,
  type: "note",
  content_type: "text/plain",
  sender: "Agent",
  subject: ticketTitle,
  body: `${quote}\n\nMeine interne Antwort.`,
  attachments: [],
};
