import { describe, expect, it } from "vitest";
import { countShortcuts, filterShortcutGroups } from "./shortcut-search";

const groups = [
  {
    group: "Allgemein",
    shortcuts: [
      { id: "palette", label: "Suchen und Befehle", keys: [["Ctrl", "K"]] },
      { id: "help", label: "Tastenkürzel anzeigen", keys: [["?"]] },
    ],
  },
  {
    group: "Navigation",
    shortcuts: [
      { id: "back", label: "Zurück", keys: [["Alt", "←"]] },
      { id: "home", label: "Übersicht", keys: [["G"], ["H"]] },
    ],
  },
  {
    group: "Ticket-Tabs",
    shortcuts: [
      { id: "prevTab", label: "Vorheriger Ticket-Tab", keys: [["Ctrl", "Shift", "Tab"]] },
      { id: "tabByIndex", label: "Ticket-Tab 1 bis 9", keys: [["⌘", "1–9"]] },
    ],
  },
  { group: "Listen", shortcuts: [{ id: "openRow", label: "Eintrag öffnen", keys: [["↵"]] }] },
];

const ids = (query: string) => filterShortcutGroups(groups, query).flatMap((group) => group.shortcuts.map((s) => s.id));

describe("filterShortcutGroups", () => {
  it("liefert bei leerer Suche alle Gruppen unverändert", () => {
    expect(filterShortcutGroups(groups, "   ")).toEqual(groups);
  });

  it("findet nach Aktionsname ohne Groß-/Kleinschreibung", () => {
    expect(ids("ZURÜCK")).toEqual(["back"]);
  });

  it("findet alle Kürzel einer Gruppe über den Gruppennamen und blendet leere Gruppen aus", () => {
    const result = filterShortcutGroups(groups, "navigation");
    expect(result.map((group) => group.group)).toEqual(["Navigation"]);
    expect(countShortcuts(result)).toBe(2);
  });

  it("verknüpft mehrere Begriffe, auch in Plus-Schreibweise der Tasten", () => {
    expect(ids("ctrl+k")).toEqual(["palette"]);
    expect(ids("ctrl shift tab")).toEqual(["prevTab"]);
    expect(ids("g h")).toEqual(["home"]);
  });

  it("wertet einzelne Zeichen als Taste oder Wortanfang statt als beliebigen Teilstring", () => {
    expect(ids("k")).toEqual(["palette"]);
    expect(ids("z")).toEqual(["back"]);
    expect(ids("?")).toEqual(["help"]);
  });

  it("versteht plattformübliche Namen für angezeigte Symbole und Modifier", () => {
    expect(ids("strg k")).toEqual(["palette"]);
    expect(ids("cmd 5")).toEqual(["tabByIndex"]);
    expect(ids("enter")).toEqual(["openRow"]);
    expect(ids("pfeil links")).toEqual(["back"]);
  });

  it("lässt Gruppen ohne Treffer weg und meldet keine Treffer als leere Liste", () => {
    expect(filterShortcutGroups(groups, "gibt es nicht")).toEqual([]);
  });
});
