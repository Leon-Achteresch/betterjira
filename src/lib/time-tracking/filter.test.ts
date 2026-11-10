import { describe, expect, it } from "vitest";
import type { TimeEntry, TimeSummary } from "./aggregate";
import { filterTimeSummary } from "./filter";

const entry = (id: string, issueKey: string, summary: string, comment: string, seconds: number, started: number): TimeEntry => ({
  id,
  issueKey,
  summary,
  comment,
  seconds,
  started,
});

const week: TimeSummary = {
  days: [
    {
      day: "2026-11-02",
      seconds: 5401,
      entries: [entry("1", "DEMO-1", "Login (Beta)", "Anforderungen abgestimmt", 3600, 1), entry("2", "DEMO-1", "Login (Beta)", "", 1801, 2)],
    },
    { day: "2026-11-03", seconds: 0, entries: [] },
    {
      day: "2026-11-04",
      seconds: 2700,
      entries: [entry("3", "OPS-12", "Übergabe", "Testfälle ergänzt", 900, 3), entry("4", "DEMO-2", "Review", "Login prüfen [x]*", 1800, 4)],
    },
  ],
  seconds: 8101,
  entryCount: 4,
  issueCount: 3,
};

const ids = (summary: TimeSummary) => summary.days.flatMap((day) => day.entries.map((item) => item.id));

describe("Meine Zeiterfassung: Suche", () => {
  it("findet Schlüssel, Titel und Kommentar ohne Groß-/Kleinschreibung", () => {
    expect(ids(filterTimeSummary(week, "ops-12"))).toEqual(["3"]);
    expect(ids(filterTimeSummary(week, "ÜBERGABE"))).toEqual(["3"]);
    expect(ids(filterTimeSummary(week, "login"))).toEqual(["1", "2", "4"]);
  });

  it("verlangt alle Wörter und behandelt Sonderzeichen wörtlich", () => {
    expect(ids(filterTimeSummary(week, "login abgestimmt"))).toEqual(["1"]);
    expect(ids(filterTimeSummary(week, "(beta)"))).toEqual(["1", "2"]);
    expect(ids(filterTimeSummary(week, "[x]*"))).toEqual(["4"]);
    expect(ids(filterTimeSummary(week, ".*"))).toEqual([]);
  });

  it("blendet leere Tage aus und rechnet Summen in Sekunden neu", () => {
    const result = filterTimeSummary(week, "DEMO");
    expect(result.days.map((day) => day.day)).toEqual(["2026-11-02", "2026-11-04"]);
    expect(result.days.map((day) => day.seconds)).toEqual([5401, 1800]);
    expect(result).toMatchObject({ seconds: 7201, entryCount: 3, issueCount: 2 });
  });

  it("lässt die Gesamtsumme unverändert und liefert bei keinem Treffer nichts", () => {
    const result = filterTimeSummary(week, "nichts davon");
    expect(result).toEqual({ days: [], seconds: 0, entryCount: 0, issueCount: 0 });
    expect(week.seconds).toBe(8101);
    expect(week.days).toHaveLength(3);
  });
});
