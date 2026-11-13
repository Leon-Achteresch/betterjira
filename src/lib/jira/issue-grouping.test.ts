import { describe, expect, it } from "vitest";
import { groupIssues, issueGridEntries } from "./issue-grouping";
import type { SearchIssue } from "./search";
import { DEFAULT_VIEW } from "./issue-view";
import { readIssueViews } from "../view-preferences";

const issue = (id: string, fields: Record<string, unknown>): SearchIssue => ({ id, key: `DEMO-${id}`, fields });

describe("groupIssues", () => {
  it("keeps the server order inside groups and puts missing values last", () => {
    const issues = [
      issue("3", { status: { id: "doing", name: "In Arbeit" } }),
      issue("4", { status: null }),
      issue("1", { status: { id: "done", name: "Erledigt" } }),
      issue("2", { status: { id: "doing", name: "In Arbeit" } }),
    ];
    const groups = groupIssues(issues, "status");
    expect(groups.map(({ label }) => label)).toEqual(["Erledigt", "In Arbeit", "Ohne Wert"]);
    expect(groups[1]?.issues.map(({ id }) => id)).toEqual(["3", "2"]);
    expect(issues.map(({ id }) => id)).toEqual(["3", "4", "1", "2"]);
  });

  it("does not merge people with identical names and gives unknown people a useful label", () => {
    const groups = groupIssues([
      issue("1", { assignee: { accountId: "a", displayName: "Alex" } }),
      issue("2", { assignee: { accountId: "b", displayName: "Alex" } }),
      issue("3", { assignee: { accountId: "c" } }),
      issue("4", { assignee: null }),
    ], "assignee");
    expect(groups).toHaveLength(4);
    expect(new Set(groups.map(({ id }) => id)).size).toBe(4);
    expect(groups.map(({ label }) => label)).toContain("Unbekannter Bearbeiter");
    expect(groups.at(-1)?.label).toBe("Nicht zugewiesen");
  });

  it("accepts name-only priorities and treats malformed values as missing", () => {
    const groups = groupIssues([
      issue("1", { priority: { name: "Hoch" } }),
      issue("2", { priority: { name: "Hoch" } }),
      issue("3", { priority: "Hoch" }),
      issue("4", {}),
    ], "priority");
    expect(groups.map(({ label, issues }) => [label, issues.length])).toEqual([["Hoch", 2], ["Ohne Wert", 2]]);
  });

  it("keeps collapsed groups present when later pages append matching issues", () => {
    const loaded = [issue("1", { status: { name: "Offen" } }), issue("2", { status: { name: "Erledigt" } })];
    const openId = JSON.stringify(["status", "Offen"]);
    const more = [...loaded, issue("3", { status: { name: "Offen" } })];
    const entries = issueGridEntries(more, groupIssues(more, "status"), "status", [openId]);
    expect(entries.filter((entry) => entry.kind === "issue").map((entry) => entry.issue.key)).toEqual(["DEMO-2"]);
    expect(entries.find((entry) => entry.id === openId)).toMatchObject({ collapsed: true, count: 2 });
    expect(issueGridEntries(more, [], "none", [openId]).map(({ id }) => id)).toEqual(["issue:1", "issue:2", "issue:3"]);
  });

  it("persists grouping and collapsed groups without leaking between scopes or accepting invalid state", () => {
    const current = { ...DEFAULT_VIEW, groupBy: "priority", collapsedGroups: [JSON.stringify(["priority", "Hoch"])] };
    const stored = readIssueViews({
      views: { own: current, other: { ...DEFAULT_VIEW }, invalid: { ...DEFAULT_VIEW, groupBy: "secret" } },
      saved: { own: [{ ...current, name: "Fokus" }], invalid: [{ ...current, collapsedGroups: false, name: "Kaputt" }] },
    });
    expect(stored.views.own).toEqual(current);
    expect(stored.views.other?.groupBy).toBe("none");
    expect(stored.views).not.toHaveProperty("invalid");
    expect(stored.saved.own?.[0]).toEqual({ ...current, name: "Fokus" });
    expect(stored.saved).not.toHaveProperty("invalid");
  });
});
