import { describe, expect, it } from "vitest";
import fixture from "../../../tests/jira/fixtures/status-intervals.json";
import { mergeHistoryPages, toHistoryEntry, type HistoryEntry, type HistoryPage } from "./issue-history";
import { historyTimestamp, reconstructStatusIntervals, sumStatusIntervals } from "./status-intervals";
import { statusIntervalDuration, statusIntervalTranslator } from "../status-interval-text";

const DAY = 86400000;
const page = (raw: unknown[], startAt = 0, total = raw.length): HistoryPage => ({ startAt, total, received: raw.length, entries: raw.map(toHistoryEntry).filter((entry): entry is HistoryEntry => !!entry) });
const result = (raw: unknown[] = fixture.changes, overrides: Partial<Parameters<typeof reconstructStatusIntervals>[0]> = {}) => reconstructStatusIntervals({ history: mergeHistoryPages([page(raw)]), created: fixture.created, current: fixture.current, asOf: fixture.asOf, ...overrides });
const transition = (id: string, created: string, from: string | null, to: string | null, name = "Warten") => ({ id, created, items: [{ fieldId: "status", from, to, fromString: name, toString: name }] });

describe("belegte Statusaufenthalte", () => {
  it("summiert wiederholte geschlossene Aufenthalte getrennt vom aktuellen und erhält Umbenennungen", () => {
    const data = result();
    expect(data.complete).toBe(true);
    const sum = sumStatusIntervals(data.intervals, "id:7");
    expect(sum.closedMs).toBe(2 * DAY);
    expect(sum.openMs).toBe(DAY);
    expect(sum.intervals.map((entry) => entry.kind)).toEqual(["closed", "closed", "open"]);
    expect(data.choices.find((choice) => choice.id === "7")?.names).toEqual(["Warten auf Partner", "Warten"]);
    expect(sumStatusIntervals(data.intervals, "id:3").intervals[0]).toMatchObject({ origin: "creation", duration: DAY });
  });

  it("ändert den laufenden Wert ausschließlich mit explizitem asOf", () => {
    expect(sumStatusIntervals(result(undefined, { asOf: "2026-11-08T00:00:00Z" }).intervals, "id:7")).toMatchObject({ closedMs: 2 * DAY, openMs: 2 * DAY });
  });

  it("ordnet unsortierte Seiten und dedupliziert identische überlappende Einträge", () => {
    const history = mergeHistoryPages([page(fixture.changes.slice(3).reverse(), 3, 6), page(fixture.changes.slice(0, 4).reverse(), 0, 6)]);
    expect(history.coverage).toEqual({ complete: true, contiguous: true });
    expect(mergeHistoryPages([page(fixture.changes.slice(0, 4), 0, 6), page(fixture.changes.slice(3), 3, 6)]).covered).toBe(6);
    expect(sumStatusIntervals(result([], { history }).intervals, "id:7").closedMs).toBe(2 * DAY);
  });

  it("begrenzt Teilhistorie statt den ersten Eintritt aus creation zu erfinden", () => {
    const history = mergeHistoryPages([page(fixture.changes.slice(1), 1, 6)]);
    const data = result([], { history });
    expect(data.complete).toBe(false);
    expect(sumStatusIntervals(data.intervals, "id:7")).toMatchObject({ closedMs: DAY, openMs: DAY });
    expect(data.intervals[0]).toMatchObject({ kind: "cut", end: Date.parse("2026-11-03T00:00:00Z") });
    expect(data.intervals[0].start).toBeUndefined();
  });

  it("leitet bei vollständiger leerer Historie aktuellen Aufenthalt ab Erstellung ab", () => {
    expect(sumStatusIntervals(result([]).intervals, "id:7")).toMatchObject({ closedMs: 0, openMs: 6 * DAY });
    expect(result([]).complete).toBe(true);
  });

  it.each([undefined, "unbekannt", "2026-02-30T12:00:00Z"])("erfindet ohne gültige Erstellung (%s) keinen initialen Beginn", (created) => {
    expect(result([], { created }).intervals[0]).toMatchObject({ kind: "cut" });
    expect(result([], { created }).intervals[0].start).toBeUndefined();
  });

  it("rechnet Zeitzonen und Sommerzeitwechsel als verstrichene Kalenderzeit", () => {
    const data = result([
      transition("1", "2026-10-25T01:30:00+0200", "3", "7"),
      transition("2", "2026-10-25T02:30:00+0100", "7", "3"),
    ], { created: "2026-10-01T00:00:00Z", current: { id: "3" } });
    expect(sumStatusIntervals(data.intervals, "id:7").closedMs).toBe(7200000);
    expect(historyTimestamp("2026-11-02T01:00:00.000+0100")).toBe(historyTimestamp("2026-11-02T00:00:00Z"));
  });

  it("rät bei identischen Zeitpunkten keine Reihenfolge aus History-IDs", () => {
    const data = result([transition("9", "2026-11-02T00:00:00Z", "3", "7"), transition("1", "2026-11-02T00:00:00Z", "7", "3")], { current: { id: "3" } });
    expect(data.warnings).toContain("simultaneous");
    expect(sumStatusIntervals(data.intervals, "id:7").closedMs).toBe(0);
    expect(data.intervals.every((interval) => interval.kind === "cut")).toBe(true);
  });

  it("zählt keinen Aufenthalt über einen widersprüchlichen Übergang hinweg", () => {
    const data = result([transition("1", "2026-11-02T00:00:00Z", "3", "7"), transition("2", "2026-11-03T00:00:00Z", "8", "3")], { current: { id: "3" } });
    expect(data.warnings).toContain("chain");
    expect(sumStatusIntervals(data.intervals, "id:7").closedMs).toBe(0);
    expect(sumStatusIntervals(data.intervals, "id:7").intervals[0].kind).toBe("cut");
  });

  it("trennt gleichnamige IDs und behandelt fehlende IDs ohne Namensgleichsetzung", () => {
    const data = result([transition("1", "2026-11-02T00:00:00Z", "7", "8"), transition("2", "2026-11-03T00:00:00Z", "8", null)], { current: { name: "Warten" } });
    expect(data.choices.map((choice) => choice.key)).toEqual(expect.arrayContaining(["id:7", "id:8", "name:Warten"]));
    expect(data.warnings).toContain("identity");
    expect(sumStatusIntervals(data.intervals, "id:8").closedMs).toBe(DAY);
    expect(sumStatusIntervals(data.intervals, "name:Warten").openMs).toBeUndefined();
  });

  it("bestätigt laufenden Aufenthalt nur bei passendem aktuellem Status", () => {
    const data = result(undefined, { current: { id: "99", name: "Anders" } });
    expect(data.warnings).toContain("current");
    expect(data.intervals.some((interval) => interval.kind === "open")).toBe(false);
  });

  it.each(["2026-02-30T12:00:00Z", "2026-11-02", "2026-11-02T10:00:00", "2026-11-02T24:00:00Z", "2026-11-02T00:00:00+0109x", "kein Datum"])("verwirft ungültige Zeitpunkte %s", (created) => {
    expect(historyTimestamp(created)).toBeUndefined();
    const data = result([transition("1", created, "3", "7")]);
    expect(data.warnings).toContain("invalid");
    expect(data.intervals).toEqual([]);
  });

  it.each(["2026-11-01T00:00:00Z", "ungültig"])("erfindet bei asOf %s keine negativen Intervalle", (asOf) => {
    expect(result(undefined, { asOf }).intervals).toEqual([]);
  });

  it("behandelt unlesbare Einträge, fehlende Fenster, doppelte Positionen und wechselnde totals als Lücken", () => {
    const cases = [
      [page([null, ...fixture.changes])],
      [page([{ id: "x", items: null }, ...fixture.changes])],
      [page(fixture.changes.slice(3), 3, 6), page(fixture.changes.slice(0, 2), 0, 6)],
      [page([fixture.changes[0], fixture.changes[0]])],
      [page(fixture.changes.slice(3), 3, 7), page(fixture.changes.slice(0, 3), 0, 6)],
      [page([fixture.changes[0]], 0, 1), page([transition("1", "2026-11-03T00:00:00Z", "8", "9")], 0, 1)],
    ];
    for (const pages of cases) {
      const data = result([], { history: mergeHistoryPages(pages) });
      expect(data.complete).toBe(false);
      expect(data.intervals).toEqual([]);
    }
  });

  it("verwechselt ein gleichnamiges eigenes Feld nicht mit der Statusidentität", () => {
    const entry = toHistoryEntry({ id: "1", created: fixture.created, items: [{ field: "Status", fieldId: "customfield_1", from: "3", to: "7" }] });
    expect(entry?.statusTransitions).toBeUndefined();
  });

  it("hält Eingabedaten unverändert und garantiert nichtnegative, nicht überlappende Intervalle je ID", () => {
    const before = JSON.stringify(fixture);
    const data = result();
    expect(JSON.stringify(fixture)).toBe(before);
    for (const choice of data.choices) {
      let end = 0;
      for (const interval of sumStatusIntervals(data.intervals, choice.key).intervals) {
        if (interval.duration !== undefined) {
          expect(interval.duration).toBeGreaterThanOrEqual(0);
          expect(interval.start!).toBeGreaterThanOrEqual(end);
          end = interval.end!;
        }
      }
    }
  });

  it("liefert deutsche und englische Texte sowie taggenaue Kalenderdauern ohne Arbeitszeitannahme", () => {
    expect(statusIntervalTranslator("en-US")("partial")).toContain("not a complete lifetime total");
    expect(statusIntervalTranslator("de")("calendar")).toContain("keine Arbeitszeit");
    expect(statusIntervalDuration(DAY + 3661000, "de")).toBe("1 T 1 h 1 min 1 s");
    expect(statusIntervalDuration(0, "en")).toBe("0 s");
  });
});
