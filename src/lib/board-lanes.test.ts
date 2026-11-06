import { describe, expect, it } from "vitest";
import { boardLanes } from "./board-lanes";

const issue = (key: string, priority?: string) => ({ key, fields: { priority: priority ? { name: priority } : null } });

describe("board lanes", () => {
  it("keeps a single lane without blockers", () => {
    const columns = [{ name: "Offen", issues: [issue("A", "Medium")] }];
    expect(boardLanes(columns)).toEqual([{ columns }]);
  });

  it("splits blockers into the expedite lane", () => {
    const columns = [{ name: "Offen", issues: [issue("A", "Blocker"), issue("B"), issue("C", "Medium")] }];
    expect(boardLanes(columns).map(({ name, columns }) => [name, columns[0].issues.map((i) => i.key)])).toEqual([
      ["Beschleunigen", ["A"]],
      ["Alles andere", ["B", "C"]],
    ]);
  });
});
