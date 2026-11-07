import { describe, expect, it, vi } from "vitest";
import { activePreset, presetSearch, resolveTimeRange, shiftTimeRange, timeRangeSearch } from "./range";

vi.stubEnv("TZ", "Europe/Berlin");

const today = new Date(2026, 10, 6, 15, 0);

describe("Meine Zeiterfassung: Zeitraum", () => {
  it("liest Zeitraum und Datum streng aus der URL", () => {
    expect(timeRangeSearch({ zeitraum: "tag", datum: "2026-11-02" })).toEqual({ zeitraum: "tag", datum: "2026-11-02" });
    expect(timeRangeSearch({ zeitraum: "monat", datum: "2026-02-30" })).toEqual({});
    expect(timeRangeSearch({ datum: 20261102 })).toEqual({});
  });

  it("liest die Suche aus q und liefert sonst ausdrücklich undefined", () => {
    expect(timeRangeSearch({ zeitraum: "falsch", datum: "unbekannt" })).toMatchObject({ zeitraum: undefined, datum: undefined });
    expect(timeRangeSearch({ q: "  DEMO-1 Review " })).toEqual({ q: "DEMO-1 Review" });
    expect(timeRangeSearch({ q: 1234 }).q).toBe("1234");
    for (const q of [undefined, "", "   ", ["a"], { a: 1 }, true, null]) {
      expect(timeRangeSearch({ q })).toHaveProperty("q", undefined);
    }
  });

  it("beginnt Wochen am Montag und endet exklusiv", () => {
    const week = resolveTimeRange({}, today);
    expect(week.days).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(week.start).toEqual(new Date(2026, 10, 2));
    expect(week.end).toEqual(new Date(2026, 10, 9));
  });

  it("verschiebt Tag und Woche und erkennt Voreinstellungen", () => {
    const day = resolveTimeRange(presetSearch("heute", today), today);
    expect(day.days).toEqual(["2026-11-06"]);
    expect(activePreset(day, today)).toBe("heute");
    expect(shiftTimeRange(day, -1)).toEqual({ zeitraum: "tag", datum: "2026-11-05" });

    const week = resolveTimeRange({}, today);
    expect(activePreset(week, today)).toBe("woche");
    const previous = resolveTimeRange(shiftTimeRange(week, -1), today);
    expect(activePreset(previous, today)).toBe("vorwoche");
    expect(resolveTimeRange(presetSearch("vorwoche", today), today).days[0]).toBe("2026-10-26");
    expect(activePreset(resolveTimeRange({ datum: "2026-09-01" }, today), today)).toBeUndefined();
  });

  it("deckt den Tag der Sommerzeitumstellung mit 23 Stunden ab", () => {
    const day = resolveTimeRange({ zeitraum: "tag", datum: "2026-03-29" }, today);
    expect(day.end.getTime() - day.start.getTime()).toBe(23 * 3600 * 1000);
  });
});
