import { describe, expect, it } from "vitest";
import { DEFAULT_TICKET_PRESET, TICKET_PRESETS, ticketPresetOf, ticketPresetSearch } from "./ticket-presets";

describe("ticket presets", () => {
  it("liest bekannte Ansichten aus der URL", () => {
    expect(ticketPresetOf("beobachtet")).toBe("beobachtet");
    expect(ticketPresetOf("alle")).toBe("alle");
  });

  it("fällt bei fehlender oder fremder Ansicht auf die Voreinstellung zurück", () => {
    expect(ticketPresetOf(undefined)).toBe(DEFAULT_TICKET_PRESET);
    expect(ticketPresetOf("toString")).toBe(DEFAULT_TICKET_PRESET);
    expect(ticketPresetOf(["alle"])).toBe(DEFAULT_TICKET_PRESET);
  });

  it("hält die Voreinstellung aus der URL heraus", () => {
    expect(ticketPresetSearch(DEFAULT_TICKET_PRESET)).toEqual({});
    expect(ticketPresetSearch("alle")).toEqual({ ansicht: "alle" });
  });

  it("fragt nur persönliche Tickets ab", () => {
    for (const preset of Object.values(TICKET_PRESETS)) expect(preset.jql).toContain("currentUser()");
  });
});
