import { describe, expect, it } from "vitest";
import { searchOpenTabs } from "./open-tab-search";

const tabs = [
  { key: "DEMO-12", title: "Übergabe an das Team vorbereiten" },
  { key: "OPS-3", title: "Suche für den Arbeitsalltag vereinfachen", pinned: true },
  { key: "DEMO-4" },
  { key: "DEMO-1", title: "Tastaturbedienung im Editor verbessern" },
];

const keys = (query: string) => searchOpenTabs(tabs, query).map((tab) => tab.key);

describe("searchOpenTabs", () => {
  it("liefert bei leerer Suche alle Tabs in ihrer Reihenfolge", () => {
    expect(keys("")).toEqual(["DEMO-12", "OPS-3", "DEMO-4", "DEMO-1"]);
    expect(keys("   ")).toEqual(["DEMO-12", "OPS-3", "DEMO-4", "DEMO-1"]);
  });

  it("findet Schlüssel unabhängig von Groß- und Kleinschreibung", () => {
    expect(keys("ops")).toEqual(["OPS-3"]);
    expect(keys("demo-1")).toEqual(["DEMO-12", "DEMO-1"]);
  });

  it("findet bekannte Titel und verlangt jedes Suchwort", () => {
    expect(keys("übergabe")).toEqual(["DEMO-12"]);
    expect(keys("demo editor")).toEqual(["DEMO-1"]);
    expect(keys("ops editor")).toEqual([]);
  });

  it("findet Tabs ohne bekannten Titel nur über den Schlüssel", () => {
    expect(keys("DEMO-4")).toEqual(["DEMO-4"]);
    expect(keys("undefined")).toEqual([]);
  });

  it("behält die übrigen Tab-Felder", () => {
    expect(searchOpenTabs(tabs, "ops")[0]).toBe(tabs[1]);
  });
});
