import { describe, expect, it } from "vitest";
import {
  adoptLegacyProjectPrefs,
  EMPTY_PROJECT_PREFS,
  EMPTY_PROJECT_PREFS_STORE,
  readProjectPrefsStore,
  scopedProjectPrefs,
  toggleProjectPref,
} from "./project-prefs";
import { workspaceId } from "./workspace";

const alexAtQa = workspaceId("qa-cloud", "alex");
const samAtQa = workspaceId("qa-cloud", "sam");
const alexAtOther = workspaceId("other-cloud", "alex");

describe("project prefs per Jira instance and account", () => {
  it("keeps the same project id separate across accounts and instances", () => {
    let store = toggleProjectPref(EMPTY_PROJECT_PREFS_STORE, alexAtQa, "favoriteIds", "10000");
    store = toggleProjectPref(store, samAtQa, "hiddenIds", "10000");

    expect(scopedProjectPrefs(store, alexAtQa)).toEqual({ favoriteIds: ["10000"], hiddenIds: [] });
    expect(scopedProjectPrefs(store, samAtQa)).toEqual({ favoriteIds: [], hiddenIds: ["10000"] });
    expect(scopedProjectPrefs(store, alexAtOther)).toEqual(EMPTY_PROJECT_PREFS);
  });

  it("toggles favorites and hidden ids independently and back off again", () => {
    let store = toggleProjectPref(EMPTY_PROJECT_PREFS_STORE, alexAtQa, "favoriteIds", "1");
    store = toggleProjectPref(store, alexAtQa, "hiddenIds", "1");
    store = toggleProjectPref(store, alexAtQa, "favoriteIds", "1");

    expect(scopedProjectPrefs(store, alexAtQa)).toEqual({ favoriteIds: [], hiddenIds: ["1"] });
  });

  it("shows nothing without a confirmed account", () => {
    const store = toggleProjectPref(EMPTY_PROJECT_PREFS_STORE, alexAtQa, "favoriteIds", "1");
    expect(scopedProjectPrefs(store, null)).toEqual(EMPTY_PROJECT_PREFS);
  });

  it("survives a reload unchanged", () => {
    let store = toggleProjectPref(EMPTY_PROJECT_PREFS_STORE, alexAtQa, "favoriteIds", "1");
    store = toggleProjectPref(store, alexAtOther, "hiddenIds", "2");
    expect(readProjectPrefsStore(JSON.parse(JSON.stringify(store)))).toEqual(store);
  });
});

describe("legacy global prefs", () => {
  const legacyState = { projectIds: ["1", "2"], hiddenProjectIds: ["3"] };

  it("keeps the old global lists as an unassigned offer instead of giving them to an account", () => {
    const store = readProjectPrefsStore(legacyState);
    expect(store).toEqual({ scopes: {}, legacy: { favoriteIds: ["1", "2"], hiddenIds: ["3"] } });
    expect(scopedProjectPrefs(store, alexAtQa)).toEqual(EMPTY_PROJECT_PREFS);
  });

  it("keeps the offer across reloads until it is adopted or discarded", () => {
    const store = readProjectPrefsStore(legacyState);
    expect(readProjectPrefsStore(JSON.parse(JSON.stringify(store)))).toEqual(store);
  });

  it("adopts once into the chosen account, merging with what it already has", () => {
    const own = toggleProjectPref(readProjectPrefsStore(legacyState), alexAtQa, "favoriteIds", "2");
    const adopted = adoptLegacyProjectPrefs(own, alexAtQa);

    expect(scopedProjectPrefs(adopted, alexAtQa)).toEqual({ favoriteIds: ["2", "1"], hiddenIds: ["3"] });
    expect(adopted.legacy).toBeNull();

    const again = adoptLegacyProjectPrefs(adopted, samAtQa);
    expect(again).toBe(adopted);
    expect(scopedProjectPrefs(again, samAtQa)).toEqual(EMPTY_PROJECT_PREFS);
  });

  it("offers nothing when the old lists are empty", () => {
    expect(readProjectPrefsStore({ projectIds: [], hiddenProjectIds: [] }).legacy).toBeNull();
  });
});

describe("damaged storage", () => {
  it.each([undefined, null, "kaputt", 42, [], { scopes: "x", legacy: 7 }])("falls back to empty for %j", (value) => {
    expect(readProjectPrefsStore(value)).toEqual(EMPTY_PROJECT_PREFS_STORE);
  });

  it("keeps the valid ids and drops invalid ones without losing other accounts", () => {
    const store = readProjectPrefsStore({
      scopes: {
        [alexAtQa]: { favoriteIds: ["1", 2, null, "1"], hiddenIds: "3" },
        [samAtQa]: "kaputt",
      },
      legacy: { favoriteIds: ["4"], hiddenIds: [{}] },
    });

    expect(store).toEqual({
      scopes: { [alexAtQa]: { favoriteIds: ["1"], hiddenIds: [] }, [samAtQa]: EMPTY_PROJECT_PREFS },
      legacy: { favoriteIds: ["4"], hiddenIds: [] },
    });
  });
});
