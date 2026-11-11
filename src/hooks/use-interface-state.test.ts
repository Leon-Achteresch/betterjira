import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_INTERFACE_PREFERENCES, INTERFACE_STORAGE_KEY, interfaceAccount, preferenceScope } from "@/lib/interface-state";
import { LOCAL_PREFERENCE_STORAGE } from "@/lib/local-preference-storage";
import { boardPreferencePrefix, legacyIssuePresentation, readBoardDisplay, readBoardFilters, readIssueViews, scopedBoardPreferences } from "@/lib/view-preferences";
import { DEFAULT_VIEW } from "@/lib/jira/issue-view";
import { useInterfaceState } from "./use-interface-state";

const storage = vi.hoisted(() => {
  const data = new Map<string, string>();
  const fake = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: vi.fn((key: string) => { data.delete(key); }),
  };
  vi.stubGlobal("window", { localStorage: fake });
  vi.stubGlobal("localStorage", fake);
  return { data, fake };
});

vi.mock("@/hooks/jira/use-jira-account-scope", () => ({ useJiraAccountScope: () => ({ scope: "own" }) }));

beforeEach(() => {
  vi.clearAllMocks();
  storage.fake.setItem.mockImplementation((key, value) => { storage.data.set(key, value); });
  storage.fake.getItem.mockImplementation((key) => storage.data.get(key) ?? null);
  useInterfaceState.setState(DEFAULT_INTERFACE_PREFERENCES);
  storage.data.clear();
  storage.fake.setItem.mockClear();
});

describe("dauerhafter Oberflächenzustand", () => {
  it("stellt Navigation und Suchtexte wieder her und trennt Konten", async () => {
    const state = useInterfaceState.getState();
    state.setSidebarOpen(false);
    state.setSection("own", "filters", false);
    state.setProject("own", "DEMO", true);
    state.setTableSearch("own", "project", "Dringend");
    state.setProject("colleague", "DEMO", false);
    state.setTableSearch(null, "project", "unbestätigt");
    const saved = storage.data.get(INTERFACE_STORAGE_KEY);
    expect(saved).toBeDefined();
    expect(saved).not.toContain("setSidebarOpen");
    useInterfaceState.setState(DEFAULT_INTERFACE_PREFERENCES);
    storage.data.set(INTERFACE_STORAGE_KEY, saved!);
    await useInterfaceState.persist.rehydrate();
    expect(useInterfaceState.persist.hasHydrated()).toBe(true);
    expect(useInterfaceState.getState().sidebarOpen).toBe(false);
    expect(interfaceAccount(useInterfaceState.getState(), "own")).toEqual({ sections: { filters: false }, projects: { DEMO: true }, tableSearches: { project: "Dringend" } });
    expect(interfaceAccount(useInterfaceState.getState(), "colleague").projects.DEMO).toBe(false);
    expect(interfaceAccount(useInterfaceState.getState(), null).tableSearches).toEqual({});
  });

  it("startet bei kaputtem JSON vollständig und mit sicheren Defaults", async () => {
    storage.data.set(INTERFACE_STORAGE_KEY, "{broken");
    await useInterfaceState.persist.rehydrate();
    expect(useInterfaceState.persist.hasHydrated()).toBe(true);
    expect(useInterfaceState.getState().sidebarOpen).toBe(true);
    expect(useInterfaceState.getState().accounts).toEqual({});
    expect(() => useInterfaceState.getState().setSidebarOpen(false)).not.toThrow();
  });

  it("validiert migrierte Daten statt Methoden oder ungültige Werte zu übernehmen", async () => {
    storage.data.set(INTERFACE_STORAGE_KEY, JSON.stringify({ state: { sidebarOpen: "false", setSidebarOpen: "broken", accounts: { own: { sections: { filters: false }, projects: ["DEMO"], tableSearches: { project: "x".repeat(2000) } }, broken: null } }, version: 0 }));
    await useInterfaceState.persist.rehydrate();
    expect(useInterfaceState.getState().sidebarOpen).toBe(true);
    expect(useInterfaceState.getState().accounts.own.projects).toEqual({});
    expect(useInterfaceState.getState().accounts.own.sections.filters).toBe(false);
    expect(useInterfaceState.getState().accounts.own.tableSearches.project).toHaveLength(1000);
    expect(useInterfaceState.getState().accounts).not.toHaveProperty("broken");
    expect(typeof useInterfaceState.getState().setSidebarOpen).toBe("function");
  });

  it("bleibt bei vollem oder gesperrtem Local Storage bedienbar", async () => {
    storage.fake.setItem.mockImplementation(() => { throw new Error("quota exceeded"); });
    expect(() => useInterfaceState.getState().setSidebarOpen(false)).not.toThrow();
    expect(useInterfaceState.getState().sidebarOpen).toBe(false);
    storage.fake.getItem.mockImplementation(() => { throw new Error("blocked"); });
    await expect(useInterfaceState.persist.rehydrate()).resolves.toBeUndefined();
    expect(useInterfaceState.persist.hasHydrated()).toBe(true);
  });

  it("schreibt identische Werte nicht erneut und verwirft leere Suchtexte", () => {
    LOCAL_PREFERENCE_STORAGE.setItem("test", "same");
    LOCAL_PREFERENCE_STORAGE.setItem("test", "same");
    expect(storage.fake.setItem).toHaveBeenCalledTimes(1);
    useInterfaceState.getState().setTableSearch("own", "project", "find");
    useInterfaceState.getState().setTableSearch("own", "project", "");
    expect(useInterfaceState.getState().accounts.own.tableSearches).toEqual({});
  });
});

describe("gespeicherte Ansichten", () => {
  it("übernimmt nur gültige Filter und kann Konten und Boards nicht verwechseln", () => {
    const own = boardPreferencePrefix("own");
    const other = boardPreferencePrefix("other");
    const stored = readBoardFilters({ filters: { [`${own}12`]: { assignee: ["me"] }, [`${other}12`]: { priority: ["High"] }, 12: { assignee: ["legacy"] }, broken: { priority: null } }, ignoreBoard: { valid: true, invalid: "true" }, hiddenColumns: { valid: ["Done"], invalid: 4 }, views: { broken: [null] } });
    expect(scopedBoardPreferences(stored.filters, "own")).toEqual({ 12: { assignee: ["me"] } });
    expect(scopedBoardPreferences(stored.filters, "other")).toEqual({ 12: { priority: ["High"] } });
    expect(scopedBoardPreferences(stored.filters, null)).toEqual({});
    expect(stored.ignoreBoard).toEqual({ valid: true });
    expect(stored.hiddenColumns).toEqual({ valid: ["Done"] });
    expect(stored.views).toEqual({});
    expect(readBoardFilters({ filters: { malicious: { assignee: ["me"], unknown: ["value"] } } }).filters).toEqual({ malicious: { assignee: ["me"] } });
    expect(preferenceScope("own", "12")).not.toBe(preferenceScope("other", "12"));
  });

  it("behält gültige Spalten, Dichte und benannte Ansichten bei; kaputte Konfigurationen werden verworfen", () => {
    const custom = { ...DEFAULT_VIEW, columns: ["summary", "key"], dense: true };
    const stored = readIssueViews({ views: { valid: custom, broken: { columns: null }, empty: { columns: [] } }, saved: { valid: [{ ...custom, name: "Fokus" }], broken: [null] } });
    expect(stored.views).toEqual({ valid: custom });
    expect(stored.saved).toEqual({ valid: [{ ...custom, name: "Fokus" }] });
    expect(legacyIssuePresentation({ ...custom, facets: { assignee: ["legacy-user"] }, quick: ["mine"] })).toEqual({ columns: custom.columns, dense: true });
    expect(readBoardDisplay({ hiddenProperties: "priority" }).hiddenProperties).toEqual(["rank"]);
    expect(readBoardDisplay({ insightsOpen: false, measure: "count", slice: "status", segment: "priority", hiddenProperties: [], toggleInsights: "broken" })).not.toHaveProperty("toggleInsights");
  });
});
