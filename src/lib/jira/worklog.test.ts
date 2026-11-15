import { describe, expect, it } from "vitest";
import { normalizeDuration, normalizeRemainingEstimate, worklogEstimateQuery, validateWorklog } from "./worklog";

describe("Zeiterfassung", () => {
  it.each(["15m", "30m", "1h", "2h", "1w 2d 3h 4m"])(
    "akzeptiert Jira-Dauern: %s",
    (input) => {
      expect(normalizeDuration(input)).toBe(input);
    },
  );
  it("normalisiert Leerzeichen, Großschreibung und Nulleinheiten", () => {
    expect(normalizeDuration(" 01H30M ")).toBe("1h 30m");
    expect(normalizeDuration("0h 15m")).toBe("15m");
  });
  it.each([
    "",
    "0m",
    "0h 0m",
    "-15m",
    "1.5h",
    "eine Stunde",
    "30",
    "1h Müll",
    "1h 2h",
    "99999999999999999999h",
  ])("weist ungültige Dauern zurück: %s", (input) => {
    expect(normalizeDuration(input)).toBeUndefined();
  });
  it("prüft Beginn und verhindert zukünftige Buchungen", () => {
    const now = Date.parse("2026-11-04T10:00:00Z");
    expect(validateWorklog("30m", "2026-11-04T09:00:00Z", now)).toBeUndefined();
    expect(validateWorklog("30m", "ungültig", now)).toContain(
      "gültigen Beginn",
    );
    expect(validateWorklog("30m", "2026-11-05T09:00:00Z", now)).toContain(
      "Zukunft",
    );
  });
});


describe("Explizite neue Restarbeit", () => {
  it("unterscheidet keine Vorgabe von bewusstem Nullwert", () => {
    expect(worklogEstimateQuery()).toBe("");
    expect(worklogEstimateQuery(" ")).toBe("");
    expect(normalizeRemainingEstimate("0h 0m")).toBe("0m");
    expect(worklogEstimateQuery("0m")).toBe("?adjustEstimate=new&newEstimate=0m");
    expect(worklogEstimateQuery("2h 30m")).toBe("?adjustEstimate=new&newEstimate=2h+30m");
    expect(() => worklogEstimateQuery("-1h")).toThrow();
  });
});
