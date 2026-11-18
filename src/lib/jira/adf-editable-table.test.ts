import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { adfSchema, adfToEditor } from "./adf";
import { canInsertEditableTableRow } from "./adf-editable-table";
import { OFFICE_TSV_LIMITS } from "./office-tsv";

const tableState = (rows: string[][]) => {
  const doc = adfSchema.nodeFromJSON(adfToEditor({
    type: "doc",
    version: 1,
    content: [{ type: "table", content: rows.map((cells) => ({
      type: "tableRow",
      content: cells.map((text) => ({
        type: "tableCell",
        content: [{ type: "paragraph", ...(text && { content: [{ type: "text", text }] }) }],
      })),
    })) }],
  }, true));
  const cells: number[] = [];
  doc.descendants((node, pos, parent) => {
    if (node.type.name === "paragraph" && parent?.type.name === "adfTableCell") cells.push(pos + 1);
  });
  return { doc, cells };
};

function canInsertAt(rows: string[][]) {
  const { doc, cells } = tableState(rows);
  const selection = TextSelection.create(doc, cells[0]);
  return canInsertEditableTableRow(EditorState.create({ doc, selection }));
}

describe("ADF-Tabellenzeile", () => {
  it("erlaubt eine Textauswahl innerhalb einer Zeile", () => {
    const { doc, cells } = tableState([["A", "B"], ["C", "D"]]);
    const selection = TextSelection.create(doc, cells[1], cells[0]);
    expect(canInsertEditableTableRow(EditorState.create({ doc, selection }))).toBe(true);
  });

  it("sperrt eine Textauswahl über mehrere Zeilen und die Auswahl der ganzen Tabelle", () => {
    const { doc, cells } = tableState([["A", "B"], ["C", "D"]]);
    for (const selection of [TextSelection.create(doc, cells[0], cells[2]), NodeSelection.create(doc, 0)]) {
      expect(canInsertEditableTableRow(EditorState.create({ doc, selection }))).toBe(false);
    }
  });

  it("erlaubt die letzte freie Zeile und sperrt eine zu breite oder bereits volle Tabelle", () => {
    const makeRows = (count: number, width: number) => Array.from({ length: count }, () => Array.from({ length: width }, () => ""));
    expect(canInsertAt(makeRows(OFFICE_TSV_LIMITS.rows - 1, OFFICE_TSV_LIMITS.columns))).toBe(true);
    expect(canInsertAt(makeRows(OFFICE_TSV_LIMITS.rows, 2))).toBe(false);
    expect(canInsertAt(makeRows(1, OFFICE_TSV_LIMITS.columns + 1))).toBe(false);
  });

  it("rechnet die Trenn- und Escapezeichen der neuen TSV-Größe mit", () => {
    const limit = OFFICE_TSV_LIMITS.characters;
    expect(canInsertAt([["X".repeat(limit - 3), ""]])).toBe(true);
    expect(canInsertAt([["X".repeat(limit - 2), ""]])).toBe(false);
    expect(canInsertAt([[`${"X".repeat(limit - 4)}\"`, ""]])).toBe(false);
  });
});
