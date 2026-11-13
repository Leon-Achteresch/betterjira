import { describe, expect, it } from "vitest";
import { parseIssueView, serializeIssueView } from "./issue-view-transfer";
import { DEFAULT_VIEW } from "./jira/issue-view";

describe("view transfer", () => {
  it("round-trips display, filters, sort and collapsed groups", () => {
    const view = { ...DEFAULT_VIEW, groupBy: "status" as const, collapsedGroups: ['["status","doing"]'], quick: ["mine" as const], facets: { priority: ["High"] } };
    expect(parseIssueView(serializeIssueView(view))).toEqual({ ok: true, view });
  });

  it("strips foreign properties instead of importing base queries, account data or actions", () => {
    const source = JSON.stringify({ format: "betterjira.issue-view", version: 1, credentials: "never", view: { ...DEFAULT_VIEW, jql: "project = PRIVATE", accessToken: "never", action: "delete" } });
    expect(parseIssueView(source)).toEqual({ ok: true, view: DEFAULT_VIEW });
    expect(serializeIssueView({ ...DEFAULT_VIEW, ...{ jql: "project = PRIVATE" } })).not.toContain("PRIVATE");
  });

  it.each(["", "not-json", "null", "[]", JSON.stringify({ format: "betterjira.issue-view", version: 2, view: DEFAULT_VIEW })])("rejects malformed or unsupported data: %s", (source) => {
    expect(parseIssueView(source).ok).toBe(false);
  });

  it.each([[], ["key", "key"], Array.from({ length: 81 }, (_, i) => `field${i}`)].map((columns) => ({ columns })))("rejects unusable column sets", ({ columns }) => {
    expect(parseIssueView(serializeIssueView({ ...DEFAULT_VIEW, columns })).ok).toBe(false);
  });

  it("bounds input size before parsing", () => {
    expect(parseIssueView(" ".repeat(65_537))).toMatchObject({ ok: false, error: expect.stringContaining("64 KB") });
  });
});
