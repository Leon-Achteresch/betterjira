import { describe, expect, it } from "vitest";
import { describeChanges, filterFeed, groupByIssue, type FeedItem } from "./notification-feed";

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
