import { describe, expect, it } from "vitest";
import {
  EMPTY_TAB_SET,
  adoptLegacyTabs,
  discardLegacyTabs,
  legacyTabsLabel,
  parseStoredIssueTabs,
  restoreLegacyTabs,
  tabsOf,
  undoLegacyAdoption,
  updateScopeTabs,
  withKeys,
  withoutTab,
  withPinToggled,
  withTab,
} from "./issue-tab-scopes";

const A = JSON.stringify(["cloud-a", "user-a"]);
const B = JSON.stringify(["cloud-b", "user-a"]);
const LEGACY = { keys: ["DEMO-3", "DEMO-1", "DEMO-2"], pinned: ["DEMO-1"] };

describe("parseStoredIssueTabs", () => {
  it("quarantines the old global tabs with order and pins instead of assigning them", () => {
    expect(parseStoredIssueTabs(LEGACY)).toEqual({ workspaces: {}, legacy: LEGACY });
  });

  it("drops empty legacy tabs and unknown data", () => {
    expect(parseStoredIssueTabs({ keys: [], pinned: [] })).toEqual({ workspaces: {} });
    expect(parseStoredIssueTabs(undefined)).toEqual({ workspaces: {} });
    expect(parseStoredIssueTabs("kaputt")).toEqual({ workspaces: {} });
    expect(parseStoredIssueTabs({ keys: "DEMO-1" })).toEqual({ workspaces: {} });
  });

  it("keeps valid scoped entries and the quarantine, skips broken ones", () => {
    const parsed = parseStoredIssueTabs({
      workspaces: { [A]: { keys: ["DEMO-1", "DEMO-1", "DEMO-2"], pinned: ["DEMO-2", "DEMO-9"] }, [B]: { keys: 3 } },
      legacy: LEGACY,
    });
    expect(parsed).toEqual({ workspaces: { [A]: { keys: ["DEMO-1", "DEMO-2"], pinned: ["DEMO-2"] } }, legacy: LEGACY });
  });

  it("ignores a broken quarantine without losing scoped tabs", () => {
    expect(parseStoredIssueTabs({ workspaces: { [A]: LEGACY }, legacy: { keys: 1 } })).toEqual({ workspaces: { [A]: LEGACY } });
  });
});

describe("scoped tab edits", () => {
  it("keeps the same key separately per instance", () => {
    let stored = parseStoredIssueTabs(undefined);
    stored = updateScopeTabs(stored, A, (tabs) => withPinToggled(withTab(tabs, "DEMO-1"), "DEMO-1"));
    stored = updateScopeTabs(stored, B, (tabs) => withTab(tabs, "DEMO-1"));
    expect(tabsOf(stored, A)).toEqual({ keys: ["DEMO-1"], pinned: ["DEMO-1"] });
    expect(tabsOf(stored, B)).toEqual({ keys: ["DEMO-1"], pinned: [] });
    expect(tabsOf(stored, undefined)).toBe(EMPTY_TAB_SET);
  });

  it("opens a known tab without a new object, closes key and pin together", () => {
    const tabs = { keys: ["DEMO-1", "DEMO-2"], pinned: ["DEMO-2"] };
    expect(withTab(tabs, "DEMO-1")).toBe(tabs);
    expect(withoutTab(tabs, "DEMO-2")).toEqual({ keys: ["DEMO-1"], pinned: [] });
    expect(withKeys(tabs, ["DEMO-2"])).toEqual({ keys: ["DEMO-2"], pinned: ["DEMO-2"] });
  });
});

describe("legacy quarantine", () => {
  const withLegacy = { workspaces: { [A]: { keys: ["DEMO-1", "DEMO-7"], pinned: ["DEMO-7"] } }, legacy: LEGACY };

  it("adopts into exactly one scope, legacy order and pins first", () => {
    const adopted = adoptLegacyTabs(withLegacy, A);
    expect(adopted.legacy).toBeUndefined();
    expect(tabsOf(adopted, A)).toEqual({ keys: ["DEMO-3", "DEMO-1", "DEMO-2", "DEMO-7"], pinned: ["DEMO-1", "DEMO-7"] });
    expect(tabsOf(adopted, B)).toBe(EMPTY_TAB_SET);
    expect(adoptLegacyTabs(adopted, A)).toBe(adopted);
  });

  it("undo removes only what the adoption added and restores the quarantine", () => {
    const before = tabsOf(withLegacy, A);
    let stored = adoptLegacyTabs(withLegacy, A);
    stored = updateScopeTabs(stored, A, (tabs) => withTab(tabs, "DEMO-8"));
    stored = undoLegacyAdoption(stored, A, before, LEGACY);
    expect(tabsOf(stored, A)).toEqual({ keys: ["DEMO-1", "DEMO-7", "DEMO-8"], pinned: ["DEMO-7"] });
    expect(stored.legacy).toEqual(LEGACY);
  });

  it("discards and restores without touching scoped tabs", () => {
    const discarded = discardLegacyTabs(withLegacy);
    expect(discarded.legacy).toBeUndefined();
    expect(discarded.workspaces).toBe(withLegacy.workspaces);
    expect(restoreLegacyTabs(discarded, LEGACY).legacy).toEqual(LEGACY);
  });

  it("labels the count", () => {
    expect(legacyTabsLabel(1)).toBe("1 früherer Tab");
    expect(legacyTabsLabel(3)).toBe("3 frühere Tabs");
  });
});
