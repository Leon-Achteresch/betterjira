import { describe, expect, it } from "vitest";
import { focusKeyAfterRemoval, nextIndex } from "@/lib/focusable";

describe("nextIndex", () => {
  it("starts at the first or last row when nothing is focused", () => {
    expect(nextIndex(5, -1, 1)).toBe(0);
    expect(nextIndex(5, -1, -1)).toBe(4);
  });

  it("moves by one and stops at both ends", () => {
    expect(nextIndex(5, 2, 1)).toBe(3);
    expect(nextIndex(5, 4, 1)).toBe(4);
    expect(nextIndex(5, 0, -1)).toBe(0);
  });
});

describe("focusKeyAfterRemoval", () => {
  const rows = (...keys: string[]) => keys.map((key) => ({ key }));

  it("keeps focus on a row that stays visible", () => {
    expect(focusKeyAfterRemoval(rows("A", "B"), rows("A", "B"), "B")).toBe("B");
  });

  it("moves to the next visible row, then to the previous one in display order", () => {
    expect(focusKeyAfterRemoval(rows("C", "A", "B"), rows("C", "B"), "A")).toBe("B");
    expect(focusKeyAfterRemoval(rows("C", "A", "B"), rows("C", "A"), "B")).toBe("A");
    expect(focusKeyAfterRemoval(rows("A", "B", "C", "D"), rows("A", "D"), "B")).toBe("D");
  });

  it("falls back when no neighbour is left", () => {
    expect(focusKeyAfterRemoval(rows("A"), [], "A")).toBeUndefined();
    expect(focusKeyAfterRemoval(rows("A"), rows("A"), "X")).toBeUndefined();
  });
});
