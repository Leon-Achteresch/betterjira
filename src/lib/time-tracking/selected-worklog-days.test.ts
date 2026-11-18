import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planSelectedWorklogDays, selectedWorklogDayError, selectedWorklogTime } from "./selected-worklog-days";

const now = Date.parse("2026-11-18T12:00:00+01:00");
const accountId = "mine";
const makePlan = (days: string[], time = "09:15", duration = "1H 30m") =>
  planSelectedWorklogDays({ days, time, duration, accountId, loaded: { total: 0, worklogs: [] } }, now);

beforeEach(() => vi.stubEnv("TZ", "Europe/Berlin"));
afterEach(() => vi.unstubAllEnvs());

describe("Vorschau für ausgewählte Buchungstage", () => {
  it("erzeugt ausschließlich ausdrücklich gewählte Tage und bewahrt lokale Zeit und Dauer über DST", () => {
    expect(makePlan(["2026-10-27", "2026-10-22"])).toEqual({
      partial: false,
      rows: [
        { day: "2026-10-22", time: "09:15", duration: "1h 30m", dateTime: "2026-10-22T09:15+02:00", offset: "+02:00", problem: undefined },
        { day: "2026-10-27", time: "09:15", duration: "1h 30m", dateTime: "2026-10-27T09:15+01:00", offset: "+01:00", problem: undefined },
      ],
    });
  });

  it("meldet unerreichbare und doppelt auftretende Wandzeiten sowie Zukunft", () => {
    for (const [day, reason] of [
      ["2026-03-29", "ungültig"],
      ["2026-10-25", "zweimal"],
      ["2026-11-19", "Zukunft"],
    ] as const) expect(makePlan([day], "02:30").rows?.[0]?.problem).toContain(reason);
  });

  it("verwirft leere Auswahl, Kalenderüberläufe, Wiederholungen und ungültige Uhrzeiten/Dauer", () => {
    expect(makePlan([]).error).toContain("mindestens einen");
    expect(makePlan(["2026-11-15", "2026-11-15"]).error).toContain("einmal");
    expect(makePlan(["2026-02-30"]).rows?.[0]?.problem).toContain("ungültig");
    for (const time of ["", "24:00", "09:60", "9:00", "09:15Z", "09:15:00"])
      expect(makePlan(["2026-11-15"], time).error).toContain("Startzeit");
    expect(makePlan(["2026-11-15"], "09:00", "0m").error).toContain("Dauer");
    expect(selectedWorklogDayError("2026-10-09", ["2026-10-09"])).toContain("bereits ausgewählt");
    expect(selectedWorklogDayError("2026-02-29", [])).toContain("gültiges Datum");
    expect(selectedWorklogTime("2026-11-18T09:15")).toBe("09:15");
    expect(selectedWorklogTime("2026-11-18T09:15+04:00")).toBe("");
  });

  it("markiert nur geladene Starts des eigenen Kontos und weist fehlende Abdeckung aus", () => {
    const result = planSelectedWorklogDays({
      days: ["2026-11-10", "2026-11-11"], time: "09:15", duration: "30m", accountId,
      loaded: { total: 4, worklogs: [
        { author: { accountId }, started: "2026-11-10T08:15:30.000+0000" },
        { author: { accountId: "other" }, started: "2026-11-11T09:15:00.000+0100" },
        { started: "2026-11-11T09:15:00.000+0100" },
      ] },
    }, now);
    expect(result.partial).toBe(true);
    expect(result.rows?.map(({ problem }) => problem)).toEqual(["Eigene Buchung mit diesem Beginn vorhanden.", undefined]);
  });
});
