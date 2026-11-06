import { describe, expect, it } from "vitest";
import { cycleTab, tabHotkey } from "./tab-hotkeys";

const key = (input: Partial<KeyboardEvent>) =>
  ({ key: "", code: "", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...input }) as KeyboardEvent;

describe("tabHotkey", () => {
  it("maps platform modifier shortcuts", () => {
    expect(tabHotkey(key({ key: "w", metaKey: true }), true)).toEqual({ type: "close" });
    expect(tabHotkey(key({ key: "w", ctrlKey: true }), true)).toBeUndefined();
    expect(tabHotkey(key({ key: "w", ctrlKey: true }), false)).toEqual({ type: "close" });
    expect(tabHotkey(key({ code: "Digit3", metaKey: true }), true)).toEqual({ type: "select", index: 2 });
    expect(tabHotkey(key({ code: "BracketLeft", metaKey: true }), true)).toEqual({ type: "history", step: -1 });
    expect(tabHotkey(key({ key: "ArrowRight", altKey: true }), false)).toEqual({ type: "history", step: 1 });
    expect(tabHotkey(key({ key: "Tab", ctrlKey: true, shiftKey: true }), true)).toEqual({ type: "cycle", step: -1 });
    expect(tabHotkey(key({ key: "w" }), true)).toBeUndefined();
  });
});

describe("cycleTab", () => {
  it("wraps around and starts at the edge without an active tab", () => {
    expect(cycleTab(["A", "B", "C"], "C", 1)).toBe("A");
    expect(cycleTab(["A", "B", "C"], "A", -1)).toBe("C");
    expect(cycleTab(["A", "B"], undefined, 1)).toBe("A");
    expect(cycleTab(["A", "B"], undefined, -1)).toBe("B");
    expect(cycleTab([], "A", 1)).toBeUndefined();
  });
});
