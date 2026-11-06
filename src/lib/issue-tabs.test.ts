import { describe, expect, it } from "vitest";
import { addTab, issueKeyFromHref, keepOthers, keepUntil, neighborTab, orderTabs, removeTab } from "./issue-tabs";

describe("issue tabs", () => {
  it("adds a key only once", () => {
    expect(addTab(["A-1"], "A-2")).toEqual(["A-1", "A-2"]);
    expect(addTab(["A-1"], "A-1")).toEqual(["A-1"]);
  });

  it("removes a key", () => {
    expect(removeTab(["A-1", "A-2"], "A-1")).toEqual(["A-2"]);
  });

  it("picks the right neighbor, else the left one", () => {
    expect(neighborTab(["A-1", "A-2", "A-3"], "A-2")).toBe("A-3");
    expect(neighborTab(["A-1", "A-2"], "A-2")).toBe("A-1");
    expect(neighborTab(["A-1"], "A-1")).toBeUndefined();
  });

  it("puts pinned tabs first", () => {
    expect(orderTabs(["A-1", "A-2", "A-3"], ["A-3"])).toEqual(["A-3", "A-1", "A-2"]);
  });

  it("closes others but keeps pinned tabs", () => {
    expect(keepOthers(["A-1", "A-2", "A-3"], ["A-1"], "A-3")).toEqual(["A-1", "A-3"]);
  });

  it("closes tabs to the right of the displayed order but keeps pinned tabs", () => {
    expect(keepUntil(["A-1", "A-2", "A-3", "A-4"], ["A-4"], "A-2")).toEqual(["A-1", "A-2", "A-4"]);
  });

  it("reads the issue key from a link", () => {
    expect(issueKeyFromHref("/issue/A-1")).toBe("A-1");
    expect(issueKeyFromHref("/issue/A-1?tab=x")).toBe("A-1");
    expect(issueKeyFromHref("/bereiche/A")).toBeUndefined();
    expect(issueKeyFromHref(null)).toBeUndefined();
  });
});
