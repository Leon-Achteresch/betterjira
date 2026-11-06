import { describe, expect, it } from "vitest";
import {
  filterOverviewCounts,
  filterOverviewEmptyState,
  filterOverviewSearch,
  filterOverviewStatus,
  parseFilterOverviewSearch,
  visibleFilters,
  withFavourite,
} from "./filter-overview";

const filters = [
  { id: "1", name: "Zoll-Rückfragen" },
  { id: "2", name: "offene Bugs", favourite: true },
  { id: "3", name: "Änderungen Q4", favourite: false },
  { id: "4", name: "Alle Bugs", favourite: true },
];

describe("parseFilterOverviewSearch", () => {
  it("lässt Standardwerte aus der URL weg", () => {
    expect(parseFilterOverviewSearch({ ansicht: "alle", q: "" })).toEqual({});
  });

  it("übernimmt gültige Ansicht und Suche", () => {
    expect(parseFilterOverviewSearch({ ansicht: "favoriten", q: "bug" })).toEqual({ ansicht: "favoriten", q: "bug" });
  });

  it("verwirft unbekannte Ansichten und nicht-textuelle Suchen", () => {
    expect(parseFilterOverviewSearch({ ansicht: "geteilt", q: 42 })).toEqual({});
  });

  it("baut Links für jede Ansicht mit der aktuellen Suche", () => {
    expect(filterOverviewSearch("alle", "bug")).toEqual({ q: "bug" });
    expect(filterOverviewSearch("favoriten")).toEqual({ ansicht: "favoriten" });
  });
});

describe("visibleFilters", () => {
  it("sortiert Favoriten zuerst und danach alphabetisch ohne Groß-/Kleinschreibung", () => {
    expect(visibleFilters(filters, "alle", "").map((filter) => filter.id)).toEqual(["4", "2", "3", "1"]);
  });

  it("zeigt in der Favoriten-Ansicht nur Favoriten", () => {
    expect(visibleFilters(filters, "favoriten", "").map((filter) => filter.id)).toEqual(["4", "2"]);
  });

  it("sucht im Namen unabhängig von Groß-/Kleinschreibung und Leerzeichen am Rand", () => {
    expect(visibleFilters(filters, "alle", "  BUGS ").map((filter) => filter.id)).toEqual(["4", "2"]);
    expect(visibleFilters(filters, "alle", "änder").map((filter) => filter.id)).toEqual(["3"]);
    expect(visibleFilters(filters, "favoriten", "zoll")).toEqual([]);
  });
});

describe("filterOverviewCounts", () => {
  it("zählt alle und favorisierte Filter", () => {
    expect(filterOverviewCounts(filters)).toEqual({ alle: 4, favoriten: 2 });
    expect(filterOverviewCounts([])).toEqual({ alle: 0, favoriten: 0 });
  });
});

describe("withFavourite", () => {
  it("ändert nur den betroffenen Filter und lässt die Eingabe unverändert", () => {
    const next = withFavourite(filters, "1", true);
    expect(next.find((filter) => filter.id === "1")?.favourite).toBe(true);
    expect(next.filter((filter) => filter.id !== "1")).toEqual(filters.filter((filter) => filter.id !== "1"));
    expect(filters[0]).toEqual({ id: "1", name: "Zoll-Rückfragen" });
  });

  it("macht eine Änderung mit dem Gegenwert rückgängig", () => {
    expect(withFavourite(withFavourite(filters, "2", false), "2", true)).toEqual(filters);
  });
});

describe("filterOverviewStatus", () => {
  it("behält geladene Daten auch bei Fehler einer Aktualisierung", () => {
    expect(filterOverviewStatus({ hasData: true, isError: true })).toBe("ready");
  });

  it("unterscheidet ersten Ladefehler von Laden", () => {
    expect(filterOverviewStatus({ hasData: false, isError: true })).toBe("error");
    expect(filterOverviewStatus({ hasData: false, isError: false })).toBe("pending");
  });
});

describe("filterOverviewEmptyState", () => {
  it("erklärt fehlende Treffer anders als eine leere Ansicht", () => {
    expect(filterOverviewEmptyState("alle", "x").title).toBe("Kein passender Filter");
    expect(filterOverviewEmptyState("alle", " ").title).toBe("Noch keine Filter");
    expect(filterOverviewEmptyState("favoriten", "").title).toBe("Keine Favoriten");
  });
});
