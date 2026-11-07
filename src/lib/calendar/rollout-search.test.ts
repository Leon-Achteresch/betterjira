import { describe, expect, it } from "vitest";
import type { Rollout } from "./model";
import { QUERY_MAX_LENGTH } from "@/lib/search/search-params";
import { parseKalenderSearch, resultDate, rolloutSearchStatus, searchRollouts, searchTerms } from "./rollout-search";

const rollout = (patch: Partial<Rollout> = {}): Rollout => ({
  id: "r1",
  title: "Release",
  start: new Date(2026, 10, 6, 10, 0).toISOString(),
  end: new Date(2026, 10, 6, 11, 0).toISOString(),
  notes: "",
  issues: [],
  siteUrl: "https://acme.atlassian.net",
  reminderMinutes: 15,
  outlookEventId: null,
  outlookAccountId: null,
  outlookWebLink: null,
  ...patch,
});

const rollouts = [
  rollout({ id: "late", title: "Datenbank Migration", start: new Date(2026, 11, 3, 9).toISOString(), end: new Date(2026, 11, 3, 10).toISOString(), issues: [{ key: "OPS-7", summary: "Backup" }] }),
  rollout({ id: "early", title: "Produktion Release 2.4", notes: "Monitoring (Grafana) beobachten", issues: [{ key: "DEMO-1", summary: "Login" }] }),
  rollout({ id: "plain", title: "Wartung [intern]", notes: "Kein Ticket", issues: [] }),
];

const ids = (query: string) => searchRollouts(rollouts, query).map((entry) => entry.id);

describe("parseKalenderSearch", () => {
  it("übernimmt gültigen Suchtext normalisiert", () => {
    expect(parseKalenderSearch({ q: "  Release  " })).toEqual({ q: "Release" });
    expect(parseKalenderSearch({ q: 2026 })).toEqual({ q: "2026" });
  });

  it("setzt leere und ungültige Werte explizit auf undefined", () => {
    for (const q of ["", "   ", null, true, ["a"], { a: 1 }, undefined]) {
      const search = parseKalenderSearch({ q });
      expect(Object.keys(search)).toEqual(["q"]);
      expect(search.q).toBeUndefined();
    }
  });

  it("begrenzt überlange Eingaben", () => {
    expect(parseKalenderSearch({ q: "x".repeat(QUERY_MAX_LENGTH + 20) }).q).toHaveLength(QUERY_MAX_LENGTH);
  });
});

describe("searchRollouts", () => {
  it("findet nach Titel, Notiz und Ticket-Schlüssel", () => {
    expect(ids("migration")).toEqual(["late"]);
    expect(ids("grafana")).toEqual(["early"]);
    expect(ids("ops-7")).toEqual(["late"]);
  });

  it("verlangt alle Wörter, egal in welchem Feld", () => {
    expect(ids("release demo-1")).toEqual(["early"]);
    expect(ids("release ops-7")).toEqual([]);
  });

  it("ignoriert Groß- und Kleinschreibung", () => {
    expect(ids("PRODUKTION")).toEqual(["early"]);
    expect(ids("demo-1")).toEqual(["early"]);
  });

  it("behandelt Sonderzeichen wörtlich", () => {
    expect(ids("(grafana)")).toEqual(["early"]);
    expect(ids("[intern]")).toEqual(["plain"]);
    expect(ids(".*")).toEqual([]);
    expect(ids("2.4")).toEqual(["early"]);
  });

  it("verknüpft keine Felder zu einem Wort", () => {
    expect(ids("4monitoring")).toEqual([]);
  });

  it("sortiert chronologisch und liefert ohne Suchtext nichts", () => {
    expect(searchRollouts(rollouts, "e").map((entry) => entry.id)).toEqual(["early", "plain", "late"]);
    expect(ids("   ")).toEqual([]);
    expect(searchTerms("  a   b ")).toEqual(["a", "b"]);
  });

  it("verändert die geladene Liste nicht", () => {
    const before = rollouts.map((entry) => entry.id);
    searchRollouts(rollouts, "e");
    expect(rollouts.map((entry) => entry.id)).toEqual(before);
  });
});

describe("rolloutSearchStatus", () => {
  it("meldet Laden und Fehler nicht als leere Treffer", () => {
    expect(rolloutSearchStatus({ query: "", pending: true, loaded: false })).toBe("idle");
    expect(rolloutSearchStatus({ query: "x", pending: true, loaded: false })).toBe("pending");
    expect(rolloutSearchStatus({ query: "x", pending: false, loaded: false })).toBe("error");
    expect(rolloutSearchStatus({ query: "x", pending: false, loaded: true })).toBe("ready");
  });
});

describe("resultDate", () => {
  it("nennt das Jahr", () => {
    expect(resultDate(new Date(2026, 11, 3, 9).toISOString())).toBe("Do., 3. Dez. 2026");
  });
});
