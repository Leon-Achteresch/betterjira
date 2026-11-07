import { describe, expect, it } from "vitest";
import {
  dashboardFreshness,
  freshnessMessage,
  freshnessSource,
  standLabel,
  type FreshnessSource,
} from "./dashboard-freshness";

const source = (overrides: Partial<FreshnessSource> = {}): FreshnessSource => ({
  label: "Tickets",
  hasData: true,
  updatedAt: 1_000,
  failed: false,
  errorMessage: "",
  fetchStatus: "idle",
  ...overrides,
});

const profile = (overrides: Partial<FreshnessSource> = {}) => source({ label: "Profil", updatedAt: 2_000, ...overrides });

describe("dashboardFreshness", () => {
  it("lädt initial ohne Daten", () => {
    expect(dashboardFreshness({ primary: source({ hasData: false, fetchStatus: "fetching" }), secondary: [], online: true })).toEqual({
      kind: "loading",
    });
  });

  it("unterscheidet einen Initialfehler ohne Daten", () => {
    const primary = source({ hasData: false, failed: true, errorMessage: "503" });
    expect(dashboardFreshness({ primary, secondary: [], online: true })).toEqual({ kind: "error", message: "503" });
  });

  it("zeigt beim erneuten Versuch nach Initialfehler wieder Laden", () => {
    const primary = source({ hasData: false, failed: true, fetchStatus: "fetching" });
    expect(dashboardFreshness({ primary, secondary: [], online: true }).kind).toBe("loading");
  });

  it("wartet offline ohne Daten statt endlos zu laden", () => {
    expect(dashboardFreshness({ primary: source({ hasData: false, fetchStatus: "paused" }), secondary: [], online: true }).kind).toBe(
      "waiting",
    );
    expect(dashboardFreshness({ primary: source({ hasData: false, failed: true }), secondary: [], online: false }).kind).toBe(
      "waiting",
    );
  });

  it("ist aktuell, wenn alle Abfragen erfolgreich waren, mit dem ältesten Stand", () => {
    expect(dashboardFreshness({ primary: source(), secondary: [profile()], online: true })).toEqual({
      kind: "ready",
      tone: "fresh",
      updatedAt: 1_000,
      failed: [],
      refreshing: false,
    });
  });

  it("behält Daten und meldet einen teilweisen Fehler", () => {
    const state = dashboardFreshness({ primary: source({ failed: true }), secondary: [profile()], online: true });
    expect(state).toMatchObject({ kind: "ready", tone: "partial", failed: ["Tickets"], updatedAt: 1_000 });
  });

  it("meldet einen vollständigen Fehler bei erhaltenen Daten", () => {
    const state = dashboardFreshness({ primary: source({ failed: true }), secondary: [profile({ failed: true })], online: true });
    expect(state).toMatchObject({ kind: "ready", tone: "failed", failed: ["Tickets", "Profil"] });
  });

  it("warnt auch bei leerer, aber erfolgreich geladener Arbeitsliste", () => {
    const state = dashboardFreshness({ primary: source({ failed: true }), secondary: [], online: true });
    expect(state).toMatchObject({ kind: "ready", tone: "failed" });
  });

  it("zählt eine fehlende Nebenabfrage als Teilfehler, ohne ihren Stand zu verwenden", () => {
    const state = dashboardFreshness({
      primary: source({ updatedAt: 5_000 }),
      secondary: [profile({ hasData: false, failed: true, updatedAt: 0 })],
      online: true,
    });
    expect(state).toMatchObject({ tone: "partial", updatedAt: 5_000, failed: ["Profil"] });
  });

  it("zeigt Aktualisieren, solange eine Abfrage lädt, und verschweigt deren alten Fehler", () => {
    const state = dashboardFreshness({
      primary: source({ failed: true, fetchStatus: "fetching" }),
      secondary: [profile()],
      online: true,
    });
    expect(state).toMatchObject({ tone: "refreshing", refreshing: true, failed: [] });
  });

  it("meldet pausierte Abfragen und Offline nicht als aktiv ladend", () => {
    expect(dashboardFreshness({ primary: source({ fetchStatus: "paused" }), secondary: [], online: true })).toMatchObject({
      tone: "offline",
      refreshing: false,
    });
    expect(dashboardFreshness({ primary: source(), secondary: [], online: false })).toMatchObject({ tone: "offline" });
  });
});

describe("freshnessSource", () => {
  it("übernimmt Daten, Fehler und Abrufstatus einer Abfrage", () => {
    expect(
      freshnessSource("Tickets", {
        data: { issues: [] },
        dataUpdatedAt: 42,
        status: "error",
        error: new Error("weg"),
        fetchStatus: "idle",
      }),
    ).toEqual({ label: "Tickets", hasData: true, updatedAt: 42, failed: true, errorMessage: "weg", fetchStatus: "idle" });
    expect(
      freshnessSource("Profil", { data: undefined, dataUpdatedAt: 0, status: "pending", error: null, fetchStatus: "paused" }),
    ).toMatchObject({ hasData: false, failed: false, errorMessage: "", fetchStatus: "paused" });
  });
});

describe("Texte", () => {
  it("nennt die Uhrzeit heute und das Datum an anderen Tagen", () => {
    const now = new Date(2026, 10, 6, 15, 0);
    expect(standLabel(new Date(2026, 10, 6, 9, 5).getTime(), now)).toBe("Stand 09:05 Uhr");
    expect(standLabel(new Date(2026, 10, 5, 18, 30).getTime(), now)).toBe("Stand 5. Nov., 18:30 Uhr");
  });

  it("nennt fehlgeschlagene Bereiche", () => {
    expect(freshnessMessage("partial", ["Tickets"])).toBe("Tickets nicht aktualisiert");
    expect(freshnessMessage("partial", ["Profil", "Favoriten"])).toBe("Profil und Favoriten nicht aktualisiert");
    expect(freshnessMessage("failed", ["Tickets"])).toBe("Aktualisierung fehlgeschlagen");
  });
});
