import { describe, expect, it } from "vitest";
import {
  countUnread,
  describeChanges,
  filterFeed,
  groupByIssue,
  inboxKindOf,
  inboxSearchOf,
  searchFeed,
  sectionByDay,
  type FeedItem,
} from "./notification-feed";

const item = (id: string, issueKey: string, created: number, extra: Partial<FeedItem> = {}): FeedItem => ({
  id,
  issueKey,
  summary: `Summary ${issueKey}`,
  created,
  read: false,
  kind: "watching",
  ...extra,
});

describe("describeChanges", () => {
  it("treats an assignment to me as direct", () => {
    expect(describeChanges([{ field: "assignee", to: "me", toString: "Ich" }], "me")).toEqual({
      title: "hat dir ein Ticket zugewiesen",
      body: "",
      kind: "direct",
    });
  });

  it("describes status, single fields and multiple fields", () => {
    expect(describeChanges([{ field: "status", fromString: "Offen", toString: "Fertig" }], "me").body).toBe("Offen → Fertig");
    expect(describeChanges([{ field: "priority", toString: "Hoch" }], "me")).toEqual({ title: "hat die Priorität geändert", body: "Hoch" });
    expect(describeChanges([{ field: "description", toString: "lang" }], "me").body).toBe("");
    expect(describeChanges([{ field: "labels", toString: null }, { field: "duedate", toString: null }], "me").title).toBe("hat 2 Felder aktualisiert");
  });
});

describe("groupByIssue", () => {
  it("groups per issue, newest first, and counts unread", () => {
    const groups = groupByIssue([item("a", "X-1", 1), item("b", "X-2", 3), item("c", "X-1", 5, { read: true })]);
    expect(groups.map((group) => group.issueKey)).toEqual(["X-1", "X-2"]);
    expect(groups[0]!.latest.id).toBe("c");
    expect(groups[0]!.unread).toBe(1);
  });
});

describe("filterFeed", () => {
  it("filters by kind and unread", () => {
    const items = [item("a", "X-1", 1, { kind: "direct" }), item("b", "X-1", 2, { kind: "direct", read: true }), item("c", "X-2", 3)];
    expect(filterFeed(items, "direct", false).map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(filterFeed(items, "direct", true).map((entry) => entry.id)).toEqual(["a"]);
  });
});

describe("searchFeed", () => {
  const entry = (id: string, issueKey: string, title: string, body: string, actor: string) => ({
    ...item(id, issueKey, 1),
    title,
    body,
    actor: { displayName: actor },
  });
  const items = [entry("a", "X-1", "hat einen Kommentar hinzugefügt", "Bitte Übergabe prüfen", "Sam"), entry("b", "Y-2", "hat den Status geändert", "", "Kim")];

  it("matches every term across key, summary, text and person, ignoring case", () => {
    expect(searchFeed(items, "  ").map((match) => match.id)).toEqual(["a", "b"]);
    expect(searchFeed(items, "übergabe sam").map((match) => match.id)).toEqual(["a"]);
    expect(searchFeed(items, "y-2").map((match) => match.id)).toEqual(["b"]);
    expect(searchFeed(items, "kim kommentar")).toEqual([]);
  });
});

describe("countUnread", () => {
  it("counts unread per kind", () => {
    expect(countUnread([item("a", "X-1", 1, { kind: "direct" }), item("b", "X-1", 2, { read: true }), item("c", "X-2", 3)])).toEqual({
      direct: 1,
      watching: 1,
    });
  });
});

describe("sectionByDay", () => {
  it("orders today, yesterday, the last week and older by the newest event", () => {
    const now = new Date(2026, 10, 6, 15).getTime();
    const at = (day: number, hour = 9) => new Date(2026, 10, day, hour).getTime();
    const groups = groupByIssue([
      item("a", "X-1", at(6)),
      item("b", "X-2", at(5, 23)),
      item("c", "X-3", at(1)),
      item("d", "X-4", new Date(2026, 9, 29).getTime()),
      item("e", "X-2", at(4)),
    ]);
    expect(sectionByDay(groups, now).map((section) => [section.label, section.groups.map((group) => group.issueKey)])).toEqual([
      ["Heute", ["X-1"]],
      ["Gestern", ["X-2"]],
      ["Letzte 7 Tage", ["X-3"]],
      ["Älter", ["X-4"]],
    ]);
  });
});

describe("inboxSearchOf", () => {
  it("keeps only known values and drops defaults", () => {
    expect(inboxSearchOf({ ansicht: "beobachtet", nur: "ungelesen", suche: "DEMO" })).toEqual({ ansicht: "beobachtet", nur: "ungelesen", suche: "DEMO" });
    expect(inboxSearchOf({ ansicht: "fremd", nur: "alle", suche: "  ", extra: 1 })).toEqual({});
    expect(inboxKindOf(inboxSearchOf({ ansicht: "beobachtet" }))).toBe("watching");
    expect(inboxKindOf({})).toBe("direct");
  });
});
