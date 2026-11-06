import { describe, expect, it } from "vitest";
import { projectDirectory, projectDirectorySearch } from "./project-directory";

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
});
