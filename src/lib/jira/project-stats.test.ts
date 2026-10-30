import { describe, expect, it } from "vitest";
import { type StatsIssue, computeProjectStats, median, percentile } from "./project-stats";

const issue = (key: string, category: string, created: string, extra: Partial<StatsIssue["fields"]> = {}): StatsIssue => ({
  key,
  fields: {
    summary: key,
    status: { name: category === "done" ? "Fertig" : "Offen", statusCategory: { key: category } },
    created,
    updated: created,
    issuetype: { name: "Task" },
    ...extra,
  },
});

const now = new Date("2026-10-30T12:00:00");

describe("project stats", () => {
  it("computes median and percentile", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeUndefined();
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 85)).toBe(9);
  });

  it("aggregates counts, lead times and overdue issues", () => {
    const stats = computeProjectStats(
      [
        issue("A-1", "done", "2026-10-20T10:00:00", { resolutiondate: "2026-10-24T10:00:00" }),
        issue("A-2", "new", "2026-10-01T10:00:00", { duedate: "2026-10-10", assignee: { displayName: "Kim" } }),
        issue("A-3", "indeterminate", "2026-10-29T10:00:00", { labels: ["ui", "api"] }),
      ],
      now,
    );
    expect(stats.total).toBe(3);
    expect(stats.doneCount).toBe(1);
    expect(stats.openCount).toBe(2);
    expect(stats.medianLead).toBe(4);
    expect(stats.overdueCount).toBe(1);
    expect(stats.overdueIssues[0]?.key).toBe("A-2");
    expect(stats.unassignedOpen).toBe(1);
    expect(stats.labels.map((label) => label.name).sort()).toEqual(["api", "ui"]);
    expect(stats.leadBuckets.find((bucket) => bucket.name === "3–7 Tage")?.value).toBe(1);
    expect(stats.assignees.find((group) => group.name === "Kim")?.overdue).toBe(1);
    expect(stats.monthly.at(-1)?.backlog).toBe(2);
  });
});
