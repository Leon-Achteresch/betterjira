import { describe, expect, it } from "vitest";
import { compareText, projectDirectory, projectDirectorySearch, sortProjectEntries } from "./project-directory";

const projects = [
  { id: "1", key: "DEMO", name: "Produktentwicklung" },
  { id: "2", key: "OPS", name: "Betrieb" },
  { id: "3", key: "OLD", name: "Archiv" },
];

const prefs = { favoriteIds: ["2", "99"], hiddenIds: ["3"] };

describe("projectDirectory", () => {
  it("zeigt versteckte Bereiche gekennzeichnet und sucht in Name und Schlüssel", () => {
    const result = projectDirectory(projects, { ...prefs, query: "  o ", view: "alle" });
    expect(result.entries.map((entry) => [entry.project.key, entry.favorite, entry.hidden])).toEqual([
      ["DEMO", false, false],
      ["OPS", true, false],
      ["OLD", false, true],
    ]);
    expect(projectDirectory(projects, { ...prefs, query: "arch", view: "alle" }).entries[0]?.project.key).toBe("OLD");
  });

  it("zählt nur geladene Favoriten und unterscheidet die Leerzustände", () => {
    const favorites = projectDirectory(projects, { ...prefs, query: "", view: "favoriten" });
    expect(favorites.entries.map((entry) => entry.project.key)).toEqual(["OPS"]);
    expect(favorites.counts).toEqual({ alle: 3, favoriten: 1 });
    expect(projectDirectory(projects, { ...prefs, query: "xyz", view: "favoriten" }).empty).toBe("no-matches");
    expect(projectDirectory(projects, { favoriteIds: [], hiddenIds: [], query: "", view: "favoriten" }).empty).toBe("no-favorites");
    expect(projectDirectory([], { ...prefs, query: "", view: "alle" }).empty).toBe("none");
  });
});

describe("projectDirectorySearch", () => {
  it("lässt Standardwerte weg und verwirft ungültige Werte", () => {
    expect(projectDirectorySearch({ q: "  ", ansicht: "alle" })).toEqual({});
    expect(projectDirectorySearch({ q: 42, ansicht: "geheim" })).toEqual({});
    expect(projectDirectorySearch({ q: 42 })).toHaveProperty("q", undefined);
    expect(projectDirectorySearch({ ansicht: "geheim" })).toHaveProperty("ansicht", undefined);
    expect(projectDirectorySearch({ q: "ops ", ansicht: "favoriten" })).toEqual({ q: "ops ", ansicht: "favoriten" });
    expect(projectDirectorySearch({ q: "x".repeat(300) }).q).toHaveLength(200);
  });

  it("übernimmt nur gültige Sortierungen und lässt Standard ausdrücklich undefiniert", () => {
    expect(projectDirectorySearch({ sort: "name" })).toEqual({ sort: "name" });
    expect(projectDirectorySearch({ sort: "favoriten", ansicht: "favoriten" })).toEqual({ ansicht: "favoriten", sort: "favoriten" });
    for (const sort of ["standard", "NAME", "", 3, null, ["name"]]) {
      const search = projectDirectorySearch({ sort });
      expect(search).toHaveProperty("sort", undefined);
      expect(search).toEqual({});
    }
  });
});

const entry = (id: string, key: string, name: string, favorite = false) => ({ project: { id, key, name }, favorite });
const order = (entries: readonly ReturnType<typeof entry>[]) => entries.map((item) => item.project.id);

describe("compareText", () => {
  it("vergleicht natürlich, deutsch und ohne Groß-/Kleinschreibung", () => {
    expect(["Team 10", "Team 2", "team 1"].sort(compareText)).toEqual(["team 1", "Team 2", "Team 10"]);
    expect(["Zoll", "Apfel", "Ober", "Öl", "Äpfel"].sort(compareText)).toEqual(["Apfel", "Äpfel", "Ober", "Öl", "Zoll"]);
    expect(compareText("Archiv", "archiv")).toBe(0);
  });

  it("sortiert leere und nur aus Leerzeichen bestehende Werte ans Ende", () => {
    expect(["", "Beta", "  ", "Alpha"].sort(compareText)).toEqual(["Alpha", "Beta", "", "  "]);
    expect(compareText("", "")).toBe(0);
  });
});

describe("sortProjectEntries", () => {
  const entries = [
    entry("1", "WEB10", "Webauftritt", true),
    entry("2", "WEB2", "betrieb"),
    entry("3", "OPS", "Betrieb", true),
    entry("4", "ÄND", "Änderungen"),
    entry("5", "", ""),
    entry("6", "ADM", "Administration", true),
  ];

  it("behält bei Standard die geladene Reihenfolge und liefert eine Kopie", () => {
    const sorted = sortProjectEntries(entries, "standard");
    expect(order(sorted)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(sorted).not.toBe(entries);
  });

  it("sortiert nach Name, Schlüssel und Favoriten stabil bei gleichen Werten", () => {
    expect(order(sortProjectEntries(entries, "name"))).toEqual(["6", "4", "2", "3", "1", "5"]);
    expect(order(sortProjectEntries(entries, "schluessel"))).toEqual(["6", "4", "3", "2", "1", "5"]);
    expect(order(sortProjectEntries(entries, "favoriten"))).toEqual(["6", "3", "1", "4", "2", "5"]);
  });

  it("verändert die Eingabe nie", () => {
    const frozen = Object.freeze(entries.map((item) => Object.freeze(item)));
    const before = order(frozen);
    for (const sort of ["standard", "name", "schluessel", "favoriten"] as const) sortProjectEntries(frozen, sort);
    expect(order(frozen)).toEqual(before);
  });
});

describe("projectDirectory mit Sortierung", () => {
  it("sortiert nur gefilterte Treffer und lässt die Projektliste unverändert", () => {
    const loaded = Object.freeze([...projects]);
    const result = projectDirectory(loaded, { ...prefs, query: "", view: "alle", sort: "name" });
    expect(result.entries.map((item) => item.project.key)).toEqual(["OLD", "OPS", "DEMO"]);
    expect(result.entries[0]?.hidden).toBe(true);
    expect(loaded.map((project) => project.key)).toEqual(["DEMO", "OPS", "OLD"]);
    expect(projectDirectory(loaded, { ...prefs, query: "o", view: "alle", sort: "favoriten" }).entries.map((item) => item.project.key)).toEqual([
      "OPS",
      "OLD",
      "DEMO",
    ]);
    expect(projectDirectory(loaded, { ...prefs, query: "", view: "alle" }).entries.map((item) => item.project.key)).toEqual(["DEMO", "OPS", "OLD"]);
  });
});
