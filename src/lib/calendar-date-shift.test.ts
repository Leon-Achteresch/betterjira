import { afterEach, describe, expect, it, vi } from "vitest";
import { parseDayOffset, shiftCalendarDate } from "./calendar-date-shift";

afterEach(() => vi.unstubAllEnvs());

describe("Kalendertage ohne Zeitzonenverlust", () => {
  it.each(["Europe/Berlin", "America/Los_Angeles", "Pacific/Auckland", "UTC"])("bleibt ueber DST und Jahresgrenzen in %s exakt", (timezone) => {
    vi.stubEnv("TZ", timezone);
    expect(shiftCalendarDate("2026-03-28", 2)).toBe("2026-03-30");
    expect(shiftCalendarDate("2026-10-24", 2)).toBe("2026-10-26");
    expect(shiftCalendarDate("2026-03-30", -2)).toBe("2026-03-28");
    expect(shiftCalendarDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftCalendarDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftCalendarDate("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftCalendarDate("2000-02-28", 1)).toBe("2000-02-29");
    expect(shiftCalendarDate("1900-02-28", 1)).toBe("1900-03-01");
    expect(shiftCalendarDate("0099-12-31", 1)).toBe("0100-01-01");
  });
  it.each(["2026-02-30", "1900-02-29", "2026-13-01", "2026-00-01", "2026-01-00", "2026-1-2", "", "2026-03-28T00:00:00Z", "0000-01-01"])("erfindet fuer %s kein Datum", (value) => {
    expect(shiftCalendarDate(value, 1)).toBeNull();
  });
  it("weist ungueltige Offsets und nicht darstellbare Zieldaten ab", () => {
    for (const offset of [0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(shiftCalendarDate("2026-01-01", offset)).toBeNull();
    expect(shiftCalendarDate("0001-01-01", -1)).toBeNull();
    expect(shiftCalendarDate("9999-12-31", 1)).toBeNull();
    expect(shiftCalendarDate("2026-01-01", Number.MAX_SAFE_INTEGER)).toBeNull();
  });
  it("akzeptiert nur explizite ganze Tage ungleich Null", () => {
    expect(parseDayOffset(" +30 ")).toBe(30);
    expect(parseDayOffset("-3")).toBe(-3);
    for (const input of ["", "0", "-0", "1.5", "1e2", "7 Tage", "Infinity", "9007199254740992"]) expect(parseDayOffset(input)).toBeNull();
  });
});
