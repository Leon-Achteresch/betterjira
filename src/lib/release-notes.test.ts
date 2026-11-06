import { describe, expect, it } from "vitest";
import { extractHighlights, publishedLabel } from "./release-notes";

describe("extractHighlights", () => {
  it("liest Listenpunkte ohne Markdown und Duplikate, maximal drei", () => {
    const notes = "### Neu\n\n- **Tabs** im [Header](https://x)\n- `J/K` Navigation\n- **Tabs** im Header\n1. Dark Mode\n- Vierter";
    expect(extractHighlights(notes)).toEqual(["Tabs im Header", "J/K Navigation", "Dark Mode"]);
  });

  it("liefert nichts für Fließtext", () => {
    expect(extractHighlights("Lade unten den Installer herunter.")).toEqual([]);
  });
});

describe("publishedLabel", () => {
  it("formatiert gültige Daten und ignoriert ungültige", () => {
    expect(publishedLabel("2026-11-06T10:00:00Z")).toBe("06.11.2026");
    expect(publishedLabel("kaputt")).toBeNull();
    expect(publishedLabel(undefined)).toBeNull();
  });
});
