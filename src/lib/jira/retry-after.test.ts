import { describe, expect, it } from "vitest";
import { parseHttpDate, rateLimitMessage, retryAtFrom } from "./retry-after";

const NOW = Date.UTC(2026, 10, 7, 13, 0, 0);

describe("parseHttpDate", () => {
  it("liest alle drei HTTP-Datumsformate als UTC", () => {
    const expected = Date.UTC(1994, 10, 6, 8, 49, 37);
    expect(parseHttpDate("Sun, 06 Nov 1994 08:49:37 GMT", NOW)).toBe(expected);
    expect(parseHttpDate("Sunday, 06-Nov-94 08:49:37 GMT", NOW)).toBe(expected);
    expect(parseHttpDate("Sun Nov  6 08:49:37 1994", NOW)).toBe(expected);
  });

  it("legt zweistellige Jahre höchstens 50 Jahre in die Zukunft", () => {
    expect(parseHttpDate("Saturday, 07-Nov-26 13:05:00 GMT", NOW)).toBe(Date.UTC(2026, 10, 7, 13, 5, 0));
    expect(parseHttpDate("Wednesday, 01-Jan-76 00:00:00 GMT", NOW)).toBe(Date.UTC(2076, 0, 1));
    expect(parseHttpDate("Saturday, 01-Jan-77 00:00:00 GMT", NOW)).toBe(Date.UTC(1977, 0, 1));
  });

  it("lehnt kaputte Daten ab", () => {
    expect(parseHttpDate("Sat, 31 Feb 2026 10:00:00 GMT", NOW)).toBeUndefined();
    expect(parseHttpDate("Sat, 07 Nov 2026 25:00:00 GMT", NOW)).toBeUndefined();
    expect(parseHttpDate("Sat, 07 Nov 2026 13:05:00 CET", NOW)).toBeUndefined();
    expect(parseHttpDate("2026-11-07T13:05:00Z", NOW)).toBeUndefined();
    expect(parseHttpDate("", NOW)).toBeUndefined();
  });
});

describe("retryAtFrom", () => {
  it("rechnet Sekunden ab jetzt", () => {
    expect(retryAtFrom("120", NOW)).toBe(NOW + 120_000);
    expect(retryAtFrom(" 30 ", NOW)).toBe(NOW + 30_000);
  });

  it("übernimmt ein künftiges HTTP-Datum", () => {
    expect(retryAtFrom("Sat, 07 Nov 2026 13:05:00 GMT", NOW)).toBe(NOW + 5 * 60_000);
  });

  it("ignoriert fehlende, kaputte, vergangene und unplausible Werte", () => {
    expect(retryAtFrom(null, NOW)).toBeUndefined();
    expect(retryAtFrom("soon", NOW)).toBeUndefined();
    expect(retryAtFrom("-5", NOW)).toBeUndefined();
    expect(retryAtFrom("1.5", NOW)).toBeUndefined();
    expect(retryAtFrom("0", NOW)).toBeUndefined();
    expect(retryAtFrom("Sat, 07 Nov 2026 12:59:59 GMT", NOW)).toBeUndefined();
    expect(retryAtFrom(String(24 * 60 * 60 + 1), NOW)).toBeUndefined();
    expect(retryAtFrom("99999999999999999999999", NOW)).toBeUndefined();
    expect(retryAtFrom("Sun, 08 Nov 2026 13:00:01 GMT", NOW)).toBeUndefined();
  });
});

describe("rateLimitMessage", () => {
  const local = new Date(2026, 10, 7, 14, 32, 10).getTime();

  it("nennt ohne belastbaren Zeitpunkt nur später", () => {
    expect(rateLimitMessage(undefined, local)).toBe("Jira begrenzt gerade die Anzahl der Anfragen. Bitte später erneut versuchen.");
    expect(rateLimitMessage(local - 1000, local)).toContain("später erneut versuchen");
  });

  it("rundet den frühesten Zeitpunkt auf die nächste volle Minute auf", () => {
    expect(rateLimitMessage(local + 30_000, local)).toBe(
      "Jira begrenzt gerade die Anzahl der Anfragen. Bitte frühestens ab 14:33 Uhr erneut versuchen.",
    );
  });

  it("nennt das Datum, wenn der Zeitpunkt an einem anderen Tag liegt", () => {
    const lateEvening = new Date(2026, 10, 7, 23, 50, 0).getTime();
    expect(rateLimitMessage(lateEvening + 2 * 60 * 60_000, lateEvening)).toContain("frühestens ab 08.11., 01:50 Uhr");
  });
});
