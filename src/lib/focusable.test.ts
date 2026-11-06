import { describe, expect, it } from "vitest";
import { nextIndex } from "@/lib/focusable";

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
