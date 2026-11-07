import { describe, expect, it } from "vitest";
import { projectDirectory } from "./project-directory";
import { parseProjectSettingsSearch, projectMatchLabel } from "./project-settings-search";
import { QUERY_MAX_LENGTH } from "./search/search-params";

const projects = [
  { id: "1", key: "DEMO", name: "Produktentwicklung" },
  { id: "2", key: "OPS", name: "Betrieb" },
  { id: "3", key: "OLD", name: "Archiv 2024" },
];

const filter = (query: string, list = projects) =>
  projectDirectory(list, { query, view: "alle", favoriteIds: ["2"], hiddenIds: ["3"] });

describe("parseProjectSettingsSearch", () => {
  it("übernimmt Text gekürzt und ohne Randleerzeichen", () => {
    expect(parseProjectSettingsSearch({ q: "  ops " })).toEqual({ q: "ops" });
    expect(parseProjectSettingsSearch({ q: "x".repeat(QUERY_MAX_LENGTH + 50) }).q).toHaveLength(QUERY_MAX_LENGTH);
  });

  it("liest Zahlen aus Direktlinks als Text", () => {
    expect(parseProjectSettingsSearch({ q: 2024 })).toEqual({ q: "2024" });
  });

  it("macht leere und ungültige Werte zu undefined", () => {
    for (const q of [undefined, null, "", "   ", false, true, Number.NaN, Number.POSITIVE_INFINITY, { q: "ops" }, ["ops"]])
      expect(parseProjectSettingsSearch({ q })).toEqual({ q: undefined });
  });

  it("ignoriert fremde Parameter", () => {
    expect(parseProjectSettingsSearch({ q: "ops", ansicht: "favoriten" })).toEqual({ q: "ops" });
  });
});

describe("Bereiche-Einstellungen filtern", () => {
  it("findet nach Name und Schlüssel ohne Groß-/Kleinschreibung", () => {
    expect(filter("betr").entries.map((entry) => entry.project.key)).toEqual(["OPS"]);
    expect(filter("demo").entries.map((entry) => entry.project.key)).toEqual(["DEMO"]);
    expect(filter(" 2024 ").entries.map((entry) => entry.project.key)).toEqual(["OLD"]);
  });

  it("behält Favoriten- und Sichtbarkeitszustand gefilterter Bereiche", () => {
    expect(filter("o").entries.map(({ project, favorite, hidden }) => [project.key, favorite, hidden])).toEqual([
      ["DEMO", false, false],
      ["OPS", true, false],
      ["OLD", false, true],
    ]);
  });

  it("unterscheidet keine Treffer von einer leeren Bereichsliste", () => {
    expect(filter("zzz")).toMatchObject({ empty: "no-matches", counts: { alle: 3 } });
    expect(filter("", [])).toMatchObject({ empty: "none", counts: { alle: 0 } });
    expect(filter("ops", [])).toMatchObject({ empty: "none" });
    expect(filter("").empty).toBeNull();
  });
});

describe("projectMatchLabel", () => {
  it("zeigt die Trefferzahl im Verhältnis zur geladenen Liste", () => {
    expect(projectMatchLabel(7, 7)).toBe("7 Bereiche");
    expect(projectMatchLabel(1, 1)).toBe("1 Bereich");
    expect(projectMatchLabel(1, 7)).toBe("1 von 7 Bereichen");
    expect(projectMatchLabel(0, 7)).toBe("0 von 7 Bereichen");
  });
});
