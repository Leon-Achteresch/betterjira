import { describe, expect, it } from "vitest";
import { type InsightItem, boardInsights, insightColor, labelColor, priorityRank } from "./board-insights";

const item = (status: string, priority: string[], labels: string[], points?: number): InsightItem => ({
  values: { status: [status], priority, assignee: ["Alex"], issuetype: ["Bug"], label: labels },
  points,
});

const items = [
  item("Todo", ["High"], ["UI"], 3),
  item("Todo", ["Low"], ["UI", "API"], 2),
  item("Done", ["High"], [], 5),
  item("Review", [], ["API"]),
];

describe("boardInsights", () => {
  it("counts issues per slice in the given order", () => {
    const result = boardInsights(items, "count", "status", "none", { status: ["Todo", "Review", "Done"] });
    expect(result.total).toBe(4);
    expect(result.segments).toEqual([]);
    expect(result.rows.map((row) => [row.name, row.total])).toEqual([
      ["Todo", 2],
      ["Review", 1],
      ["Done", 1],
    ]);
  });

  it("segments by priority rank with the empty value last", () => {
    const result = boardInsights(items, "count", "status", "priority", { status: ["Todo", "Review", "Done"] });
    expect(result.segments).toEqual(["High", "Low", "Ohne Priorität"]);
    expect(result.rows[0]).toEqual({ name: "Todo", total: 2, segments: [1, 1, 0] });
    expect(result.rows[1]).toEqual({ name: "Review", total: 1, segments: [0, 0, 1] });
  });

  it("sums story points and counts multi-valued labels in every row", () => {
    const result = boardInsights(items, "points", "label", "none");
    expect(result.total).toBe(10);
    expect(result.rows).toEqual([
      { name: "UI", total: 5, segments: [] },
      { name: "API", total: 2, segments: [] },
      { name: "Ohne Label", total: 5, segments: [] },
    ]);
  });

  it("handles an empty board", () => {
    expect(boardInsights([], "count", "status", "priority")).toEqual({ total: 0, segments: [], rows: [] });
  });
});

describe("priority helpers", () => {
  it("ranks Jira priorities", () => {
    expect(["Lowest", "Medium", "Highest", "Low", "High"].sort((a, b) => priorityRank(a) - priorityRank(b))).toEqual([
      "Highest",
      "High",
      "Medium",
      "Low",
      "Lowest",
    ]);
  });

  it("colors priorities semantically and empty values muted", () => {
    expect(insightColor("priority", "Highest", 3)).toBe("var(--destructive)");
    expect(insightColor("label", "Ohne Label", 0)).toBe("var(--muted-foreground)");
    expect(insightColor("label", "UI", 6)).toBe(labelColor("UI"));
    expect(insightColor("assignee", "Alex", 6)).toBe("var(--chart-2)");
    expect(labelColor("UI")).toMatch(/^var\(--chart-[1-5]\)$/);
  });
});
