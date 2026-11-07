import { afterEach, describe, expect, it, vi } from "vitest";
import { adoptLegacyTabs, undoLegacyAdoption, withKeys } from "@/lib/issue-tab-scopes";

const STORAGE_KEY = "betterjira-issue-tabs";
const A = JSON.stringify(["cloud-a", "user-a"]);
const B = JSON.stringify(["cloud-b", "user-a"]);
const LEGACY = { keys: ["DEMO-3", "DEMO-1", "DEMO-2"], pinned: ["DEMO-1"] };

let storage = new Map<string, string>();
let writes = 0;

const load = async (raw?: string) => {
  storage = new Map(raw === undefined ? [] : [[STORAGE_KEY, raw]]);
  writes = 0;
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes++;
      storage.set(key, value);
    },
    removeItem: (key: string) => storage.delete(key),
  });
  vi.resetModules();
  const { useIssueTabStore } = await import("./use-issue-tab-store");
  return useIssueTabStore;
};

const legacyRaw = JSON.stringify({ state: LEGACY, version: 0 });
const persisted = () => JSON.parse(storage.get(STORAGE_KEY) ?? "null")?.state;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useIssueTabStore", () => {
  it("shows and writes nothing before a confirmed scope, even for compat actions", async () => {
    const store = await load(legacyRaw);
    const state = store.getState();
    expect(state.keys).toEqual([]);
    expect(state.legacy).toEqual(LEGACY);
    state.open("DEMO-9");
    state.close("DEMO-1");
    state.togglePin("DEMO-1");
    state.setKeys([]);
    state.setScope(undefined);
    expect(writes).toBe(0);
    expect(storage.get(STORAGE_KEY)).toBe(legacyRaw);
  });

  it("never assigns the quarantined tabs to the first confirmed account", async () => {
    const store = await load(legacyRaw);
    store.getState().setScope(A);
    expect(store.getState().keys).toEqual([]);
    expect(persisted()).toEqual({ workspaces: {}, legacy: LEGACY });
  });

  it("keeps tabs per account and instance across A to B to A and a reload", async () => {
    const store = await load();
    store.getState().setScope(A);
    store.getState().open("DEMO-1");
    store.getState().open("DEMO-2");
    store.getState().togglePin("DEMO-2");

    store.getState().setScope(B);
    expect(store.getState().keys).toEqual([]);
    store.getState().open("DEMO-1");
    expect(store.getState()).toMatchObject({ keys: ["DEMO-1"], pinned: [] });

    store.getState().setScope(A);
    expect(store.getState()).toMatchObject({ keys: ["DEMO-1", "DEMO-2"], pinned: ["DEMO-2"] });

    const reloaded = await load(storage.get(STORAGE_KEY));
    expect(reloaded.getState().keys).toEqual([]);
    reloaded.getState().setScope(B);
    expect(reloaded.getState()).toMatchObject({ keys: ["DEMO-1"], pinned: [] });
    reloaded.getState().setScope(A);
    expect(reloaded.getState()).toMatchObject({ keys: ["DEMO-1", "DEMO-2"], pinned: ["DEMO-2"] });
  });

  it("ignores handlers bound to the previous account", async () => {
    const store = await load();
    store.getState().setScope(A);
    store.getState().open("DEMO-1");
    const staleClose = (key: string) => store.getState().editTabs(A, (tabs) => withKeys(tabs, tabs.keys.filter((entry) => entry !== key)));
    const staleAdopt = () => store.getState().edit(A, (stored) => adoptLegacyTabs(stored, A));

    store.getState().setScope(B);
    store.getState().open("DEMO-5");
    const before = storage.get(STORAGE_KEY);
    staleClose("DEMO-1");
    staleClose("DEMO-5");
    staleAdopt();

    expect(storage.get(STORAGE_KEY)).toBe(before);
    expect(store.getState().workspaces).toEqual({ [A]: { keys: ["DEMO-1"], pinned: [] }, [B]: { keys: ["DEMO-5"], pinned: [] } });
  });

  it("hides tabs on logout and ignores later actions until the account is confirmed again", async () => {
    const store = await load();
    store.getState().setScope(A);
    store.getState().open("DEMO-1");
    store.getState().setScope(undefined);
    expect(store.getState().keys).toEqual([]);
    const count = writes;
    store.getState().open("DEMO-2");
    store.getState().close("DEMO-1");
    expect(writes).toBe(count);
    store.getState().setScope(A);
    expect(store.getState().keys).toEqual(["DEMO-1"]);
  });

  it("remembers a loaded issue only in the given confirmed scope, once", async () => {
    const store = await load();
    store.getState().remember(A, "DEMO-3");
    const count = writes;
    store.getState().remember(A, "DEMO-3");
    expect(writes).toBe(count);
    expect(store.getState().keys).toEqual([]);
    expect(store.getState().workspaces[B]).toBeUndefined();
    store.getState().setScope(A);
    expect(store.getState().keys).toEqual(["DEMO-3"]);
  });

  it("adopts legacy tabs with order and pins, undo restores the quarantine", async () => {
    const store = await load(legacyRaw);
    store.getState().setScope(A);
    store.getState().open("DEMO-7");
    const before = { keys: ["DEMO-7"], pinned: [] };

    store.getState().edit(A, (stored) => adoptLegacyTabs(stored, A));
    expect(store.getState()).toMatchObject({ keys: ["DEMO-3", "DEMO-1", "DEMO-2", "DEMO-7"], pinned: ["DEMO-1"] });
    expect(persisted().legacy).toBeUndefined();

    store.getState().edit(A, (stored) => undoLegacyAdoption(stored, A, before, LEGACY));
    expect(store.getState()).toMatchObject({ keys: ["DEMO-7"], pinned: [], legacy: LEGACY });
    expect(persisted().legacy).toEqual(LEGACY);
  });
});
