import { describe, expect, it } from "vitest";
import { groupProjects, normalizeNeedle, searchFilters } from "./sidebar-search";

const projects = [
  { id: "1", key: "DEMO", name: "Produktentwicklung" },
  { id: "2", key: "OPS", name: "Betrieb" },
  { id: "3", key: "OLD", name: "Archiv" },
];

describe("sidebar search", () => {
  it("trennt Favoriten, blendet Versteckte aus und sucht in Name und Schlüssel", () => {
    const grouped = groupProjects(projects, { needle: normalizeNeedle("  o "), favoriteIds: ["2"], hiddenIds: ["3"] });
    expect(grouped.favorites.map((project) => project.key)).toEqual(["OPS"]);
    expect(grouped.others.map((project) => project.key)).toEqual(["DEMO"]);
    expect(grouped.visible).toHaveLength(2);
  });

  it("sortiert favorisierte Filter nach vorne", () => {
    const filters = [
      { id: "a", name: "Team" },
      { id: "b", name: "Meine Bugs", favourite: true },
    ];
    expect(searchFilters(filters, "").map((filter) => filter.id)).toEqual(["b", "a"]);
    expect(searchFilters(filters, "bug").map((filter) => filter.id)).toEqual(["b"]);
  });
});
