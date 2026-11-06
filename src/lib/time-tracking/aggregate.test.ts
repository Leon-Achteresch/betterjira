import { describe, expect, it, vi } from "vitest";
import { aggregateWorklogs, parseJiraTimestamp, worklogComment } from "./aggregate";
import { timeCoverage } from "./coverage";
import { formatSeconds } from "./presentation";
import { resolveTimeRange } from "./range";

vi.stubEnv("TZ", "Europe/Berlin");

const me = "me-1";
const issue = (key: string) => ({ id: key, key, summary: `Titel ${key}` });
const log = (id: string, started: string, seconds: number, accountId = me, comment?: unknown) => ({
  id,
  author: { accountId },
  started,
  timeSpentSeconds: seconds,
  comment,
});

const week = resolveTimeRange({ datum: "2026-11-04" }, new Date(2026, 10, 6));
const aggregate = (results: Parameters<typeof aggregateWorklogs>[0]["results"], range = week) =>
  aggregateWorklogs({ accountId: me, start: range.start, end: range.end, days: range.days, results });

describe("Meine Zeiterfassung: Aggregation", () => {
  it("zählt nur Buchungen des eigenen Kontos", () => {
    const summary = aggregate([
      { issue: issue("DEMO-1"), worklogs: [log("1", "2026-11-03T09:00:00.000+0100", 3600), log("2", "2026-11-03T10:00:00.000+0100", 7200, "other")] },
      { issue: issue("DEMO-2"), worklogs: [{ id: "3", started: "2026-11-03T11:00:00.000+0100", timeSpentSeconds: 900 }] },
    ]);
    expect(summary.seconds).toBe(3600);
    expect(summary.entryCount).toBe(1);
    expect(summary.issueCount).toBe(1);
  });

  it("summiert mehrere Buchungen desselben Tickets je Tag in Sekunden", () => {
    const summary = aggregate([
      {
        issue: issue("DEMO-1"),
        worklogs: [log("1", "2026-11-03T14:00:00.000+0100", 1830), log("2", "2026-11-03T09:00:00.000+0100", 1770), log("3", "2026-11-04T09:00:00.000+0100", 45)],
      },
    ]);
    const tuesday = summary.days.find((day) => day.day === "2026-11-03");
    expect(tuesday?.seconds).toBe(3600);
    expect(tuesday?.entries.map((entry) => entry.id)).toEqual(["2", "1"]);
    expect(summary.days.find((day) => day.day === "2026-11-04")?.seconds).toBe(45);
    expect(summary.seconds).toBe(3645);
    expect(summary.issueCount).toBe(1);
    expect(summary.days).toHaveLength(7);
  });

  it("ordnet Buchungen dem lokalen Kalendertag zu und respektiert Mitternacht", () => {
    const summary = aggregate([
      {
        issue: issue("DEMO-1"),
        worklogs: [
          log("late-utc", "2026-11-03T23:30:00.000+0000", 600),
          log("before-week", "2026-11-01T22:59:00.000+0000", 600),
          log("first-minute", "2026-11-01T23:00:00.000+0000", 300),
          log("after-week", "2026-11-08T23:00:00.000+0000", 600),
        ],
      },
    ]);
    expect(summary.days.find((day) => day.day === "2026-11-04")?.entries.map((entry) => entry.id)).toEqual(["late-utc"]);
    expect(summary.days[0]?.entries.map((entry) => entry.id)).toEqual(["first-minute"]);
    expect(summary.seconds).toBe(900);
  });

  it("rechnet über die Zeitumstellung mit echten lokalen Tagesgrenzen", () => {
    const dst = resolveTimeRange({ datum: "2026-10-21" }, new Date(2026, 9, 21));
    expect(dst.end.getTime() - dst.start.getTime()).toBe(169 * 3600 * 1000);
    const summary = aggregate(
      [
        {
          issue: issue("DEMO-1"),
          worklogs: [
            log("before-switch", "2026-10-25T01:30:00.000+0200", 600),
            log("after-switch", "2026-10-25T23:30:00.000+0100", 900),
            log("next-monday", "2026-10-26T00:10:00.000+0100", 1200),
          ],
        },
      ],
      dst,
    );
    expect(summary.days.at(-1)).toMatchObject({ day: "2026-10-25", seconds: 1500 });
    expect(summary.seconds).toBe(1500);
  });

  it("entfernt doppelte Worklogs aus Seiten und Tickets", () => {
    const entry = log("same", "2026-11-05T09:00:00.000+0100", 1800);
    const summary = aggregate([
      { issue: issue("DEMO-1"), worklogs: [entry, entry] },
      { issue: issue("DEMO-2"), worklogs: [entry] },
    ]);
    expect(summary.seconds).toBe(1800);
    expect(summary.entryCount).toBe(1);
  });

  it("verwirft ungültige Zeitpunkte und Dauern", () => {
    const summary = aggregate([
      {
        issue: issue("DEMO-1"),
        worklogs: [log("a", "kein Datum", 600), log("b", "2026-11-05T09:00:00.000+0100", -60), log("c", "2026-11-05T09:00:00.000+0100", 1.5)],
      },
    ]);
    expect(summary.seconds).toBe(0);
  });

  it("liest Kommentare aus ADF und Text", () => {
    expect(worklogComment({ type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: " Review  vorbereitet " }] }] })).toBe(
      "Review vorbereitet",
    );
    expect(worklogComment("Abstimmung\nTeam")).toBe("Abstimmung Team");
    expect(worklogComment(undefined)).toBe("");
  });

  it("versteht Jira-Zeitzonen ohne Doppelpunkt", () => {
    expect(parseJiraTimestamp("2026-11-05T09:00:00.000+0100")).toBe(Date.parse("2026-11-05T08:00:00Z"));
    expect(parseJiraTimestamp("2026-11-05T09:00:00.000-0530")).toBe(Date.parse("2026-11-05T14:30:00Z"));
  });
});

describe("Meine Zeiterfassung: Vollständigkeit", () => {
  it("meldet Teilergebnisse, Fehler und gekürzte Tickets", () => {
    expect(
      timeCoverage(true, [
        { key: "A", status: "success", truncated: true },
        { key: "B", status: "error", truncated: false },
        { key: "C", status: "pending", truncated: false },
      ]),
    ).toEqual({ issuesTruncated: true, pendingCount: 1, failedKeys: ["B"], truncatedKeys: ["A"], complete: false });
    expect(timeCoverage(false, [{ key: "A", status: "success", truncated: false }]).complete).toBe(true);
  });
});

describe("Meine Zeiterfassung: Dauer", () => {
  it("zeigt Sekunden exakt ohne Dezimalstunden", () => {
    expect(formatSeconds(0)).toBe("0 min");
    expect(formatSeconds(5430)).toBe("1 h 30 min 30 s");
    expect(formatSeconds(2700)).toBe("45 min");
    expect(formatSeconds(36000)).toBe("10 h");
  });
});
