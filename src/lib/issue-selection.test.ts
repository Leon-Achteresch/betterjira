import { describe, expect, it } from "vitest";
import {
  selectedIssues,
  toggleIssueSelection,
  toggleLoadedSelection,
} from "./issue-selection";

describe("Vorgangsauswahl", () => {
  it("wählt einzelne Vorgänge und hebt sie wieder auf", () => {
    expect(toggleIssueSelection([], "A-1")).toEqual(["A-1"]);
    expect(toggleIssueSelection(["A-1", "A-2"], "A-1")).toEqual(["A-2"]);
  });
  it("wählt nur geladene Vorgänge ohne doppelte Einträge", () => {
    expect(toggleLoadedSelection(["A-1"], ["A-1", "A-2"])).toEqual([
      "A-1",
      "A-2",
    ]);
    expect(
      toggleLoadedSelection(["A-1", "A-2", "B-1"], ["A-1", "A-2"]),
    ).toEqual(["B-1"]);
  });
  it("exportiert nur sichtbare ausgewählte Vorgänge in Tabellenreihenfolge", () => {
    expect(
      selectedIssues([{ key: "A-1" }, { key: "A-2" }], ["A-2", "B-1", "A-1"]),
    ).toEqual([{ key: "A-1" }, { key: "A-2" }]);
  });
  it("behandelt leere Ergebnisse", () => {
    expect(toggleLoadedSelection([], [])).toEqual([]);
    expect(selectedIssues([], ["A-1"])).toEqual([]);
  });
});
