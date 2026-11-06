import { describe, expect, it } from "vitest";
import { JiraApiError, JiraAuthError } from "./client";
import {
  HISTORY_LIMIT,
  HISTORY_PAGE_SIZE,
  fieldLabel,
  historyErrorDetail,
  issueHistoryKeys,
  latestPageParam,
  mergeHistoryPages,
  olderPageParam,
  readableText,
  toHistoryEntry,
  type HistoryEntry,
  type HistoryPage,
} from "./issue-history";

const author = { accountId: "a1", displayName: "Kim Probe", avatarUrls: { "48x48": "https://example.test/kim.png" } };

const raw = (id: string, created: string, items: unknown[] = [{ field: "status", fromString: "Offen", toString: "In Arbeit" }]) => ({
  id,
  created,
  author,
  items,
});

const entry = (id: string, created: string): HistoryEntry => toHistoryEntry(raw(id, created))!;

const page = (startAt: number, total: number, entries: HistoryEntry[]): HistoryPage => ({ startAt, total, entries });

describe("toHistoryEntry", () => {
  it("bündelt mehrere Felder einer Änderung mit lesbaren Namen", () => {
    const result = toHistoryEntry(
      raw("100", "2026-11-04T10:00:00.000+0100", [
        { field: "status", fieldId: "status", from: "1", fromString: "Offen", to: "3", toString: "In Arbeit" },
        { field: "assignee", fieldId: "assignee", from: null, fromString: null, to: "a2", toString: "Sam Muster" },
        { field: "Story Points", fieldId: "customfield_10016", fromString: "3", toString: "5" },
        { field: "Fix Version", fieldId: "fixVersions", fromString: null, toString: "1.2" },
      ]),
    );
    expect(result?.author).toEqual({ displayName: "Kim Probe", avatarUrl: "https://example.test/kim.png" });
    expect(result?.changes).toEqual([
      { field: "Status", from: { kind: "text", text: "Offen", long: false }, to: { kind: "text", text: "In Arbeit", long: false } },
      { field: "Bearbeiter", from: { kind: "empty" }, to: { kind: "text", text: "Sam Muster", long: false } },
      { field: "Story Points", from: { kind: "text", text: "3", long: false }, to: { kind: "text", text: "5", long: false } },
      { field: "Lösungsversion", from: { kind: "empty" }, to: { kind: "text", text: "1.2", long: false } },
    ]);
  });

  it("zeigt fehlende Feldnamen und reine IDs neutral", () => {
    expect(fieldLabel(undefined, undefined)).toBe("Unbekanntes Feld");
    expect(fieldLabel("customfield_10042", "customfield_10042")).toBe("Unbekanntes Feld");
    expect(fieldLabel(null, "duedate")).toBe("Fälligkeitsdatum");
    const result = toHistoryEntry(
      raw("101", "2026-11-04T10:00:00Z", [
        { from: "10001", to: "10002" },
        { field: "WorklogId", to: "20077", toString: "20077" },
        { field: "Sprint", from: "5", fromString: "  ", to: null, toString: null },
      ]),
    );
    expect(result?.changes).toEqual([
      { field: "Unbekanntes Feld", from: { kind: "opaque" }, to: { kind: "opaque" } },
      { field: "Arbeitsprotokoll", from: { kind: "empty" }, to: { kind: "opaque" } },
      { field: "Sprint", from: { kind: "opaque" }, to: { kind: "empty" } },
    ]);
  });

  it("macht Zeitschätzungen in Sekunden lesbar", () => {
    const result = toHistoryEntry(raw("102", "2026-11-04T10:00:00Z", [{ field: "timeestimate", fromString: "5400", toString: "0" }]));
    expect(result?.changes[0]).toMatchObject({ from: { text: "1h 30m" }, to: { text: "0m" } });
  });

  it("behandelt unbekannte oder gelöschte Personen und fehlende Zeitpunkte neutral", () => {
    expect(toHistoryEntry({ id: "1", created: "2026-11-04T10:00:00Z", items: [] })?.author).toBeUndefined();
    expect(toHistoryEntry({ id: "2", created: "2026-11-04T10:00:00Z", author: { accountId: "x", displayName: "  " }, items: [] })?.author).toBeUndefined();
    expect(toHistoryEntry({ id: "3", author: { displayName: "Ehemaliger Nutzer" }, items: [] })).toEqual({
      id: "3",
      author: { displayName: "Ehemaliger Nutzer" },
      changes: [],
    });
    expect(toHistoryEntry({ id: "4", created: "kein Datum", author: null })?.created).toBeUndefined();
  });

  it("verwirft unlesbare Einträge und einzelne unlesbare Felder", () => {
    expect(toHistoryEntry(null)).toBeUndefined();
    expect(toHistoryEntry({ created: "2026-11-04T10:00:00Z" })).toBeUndefined();
    expect(toHistoryEntry({ id: 7, items: [] })).toBeUndefined();
    expect(toHistoryEntry(raw("5", "2026-11-04T10:00:00Z", ["kaputt", { field: "labels", toString: "ux" }]))?.changes).toEqual([
      { field: "Labels", from: { kind: "empty" }, to: { kind: "text", text: "ux", long: false } },
    ]);
  });
});

describe("sichere Textdarstellung", () => {
  it("lässt Markup als reinen Text und entfernt Steuerzeichen", () => {
    expect(readableText("<img src=x onerror=alert(1)>")).toBe("<img src=x onerror=alert(1)>");
    expect(readableText("A\u0000B‮C\r\nD​ ")).toBe("ABC\nD");
    expect(readableText({ toString: () => "x" })).toBe("");
  });

  it("kürzt sehr lange Werte und markiert lange oder mehrzeilige Inhalte", () => {
    const long = "x".repeat(5000);
    const result = toHistoryEntry(
      raw("6", "2026-11-04T10:00:00Z", [
        { field: "description", fromString: long, toString: "eins\nzwei\ndrei\nvier" },
        { field: "summary", fromString: "kurz", toString: "y".repeat(200) },
      ]),
    );
    const [description, summary] = result!.changes;
    expect(description?.from).toMatchObject({ kind: "text", long: true });
    expect(description?.from.kind === "text" && description.from.text.length).toBeLessThanOrEqual(2002);
    expect(description?.to).toMatchObject({ kind: "text", long: true });
    expect(summary?.from).toMatchObject({ long: false });
    expect(summary?.to).toMatchObject({ long: true });
  });
});

describe("Paging und Zusammenführung", () => {
  it("lädt zuerst die neueste Seite und danach lückenlos ältere", () => {
    expect(latestPageParam(5)).toEqual({ startAt: 0, maxResults: HISTORY_PAGE_SIZE });
    expect(latestPageParam(45)).toEqual({ startAt: 25, maxResults: HISTORY_PAGE_SIZE });
    const latest = page(25, 45, []);
    expect(olderPageParam([latest])).toEqual({ startAt: 5, maxResults: 20 });
    expect(olderPageParam([latest, page(5, 45, [])])).toEqual({ startAt: 0, maxResults: 5 });
    expect(olderPageParam([latest, page(5, 45, []), page(0, 45, [])])).toBeUndefined();
  });

  it("stoppt an der benannten Obergrenze", () => {
    const total = HISTORY_LIMIT + 50;
    const pages = [page(total - HISTORY_LIMIT, total, [])];
    expect(olderPageParam(pages)).toBeUndefined();
    expect(mergeHistoryPages(pages)).toMatchObject({ covered: HISTORY_LIMIT, total });
  });

  it("sortiert neueste zuerst und entfernt Duplikate stabil nach History-ID", () => {
    const newer = page(2, 4, [entry("3", "2026-11-03T10:00:00Z"), entry("4", "2026-11-04T10:00:00Z")]);
    const older = page(0, 4, [entry("1", "2026-11-01T10:00:00Z"), entry("2", "2026-11-02T10:00:00Z"), entry("3", "2026-11-03T10:00:00Z")]);
    const merged = mergeHistoryPages([newer, older]);
    expect(merged.entries.map((item) => item.id)).toEqual(["4", "3", "2", "1"]);
    expect(merged).toMatchObject({ total: 4, covered: 4 });
  });

  it("ordnet gleiche Zeitpunkte numerisch nach ID und unbekannte Zeitpunkte ans Ende", () => {
    const same = "2026-11-04T10:00:00Z";
    const undated = toHistoryEntry({ id: "50", items: [] })!;
    const merged = mergeHistoryPages([page(0, 3, [entry("9", same), undated, entry("10", same)])]);
    expect(merged.entries.map((item) => item.id)).toEqual(["10", "9", "50"]);
  });

  it("meldet ohne Seiten einen leeren Stand", () => {
    expect(mergeHistoryPages([])).toEqual({ entries: [], total: 0, covered: 0 });
  });
});

describe("historyErrorDetail", () => {
  it("übersetzt Jira-Fehler ohne rohes HTML", () => {
    expect(historyErrorDetail(new JiraApiError({ status: 404, body: "" }))).toMatch(/nicht gefunden/);
    expect(historyErrorDetail(new JiraApiError({ status: 400, body: JSON.stringify({ errorMessages: ["Ungültig"] }) }))).toBe("Ungültig");
    expect(historyErrorDetail(new JiraApiError({ status: 502, body: "<html><script>x</script></html>" }))).toBe("Jira antwortet mit Status 502.");
    expect(historyErrorDetail(new JiraAuthError({ message: "Atlassian ist nicht erreichbar" }))).toBe("Atlassian ist nicht erreichbar");
    expect(historyErrorDetail(new Error("Expected number at [\"total\"]"))).toBe("Jira hat eine unerwartete Antwort geliefert.");
  });
});

describe("issueHistoryKeys", () => {
  it("trennt Cache nach Instanz, Konto und Ticket", () => {
    const keys = [
      issueHistoryKeys.issue("cloud-a", "user-a", "DEMO-1"),
      issueHistoryKeys.issue("cloud-b", "user-a", "DEMO-1"),
      issueHistoryKeys.issue("cloud-a", "user-b", "DEMO-1"),
      issueHistoryKeys.issue("cloud-a", "user-a", "DEMO-2"),
    ];
    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(4);
    expect(keys[0]?.[0]).toBe("jira");
  });
});
