import { describe, expect, it } from "vitest";
import { adfSchema, adfToEditor, editorToAdf } from "./adf";
import { OFFICE_TSV_LIMITS, parseOfficeTsv } from "./office-tsv";

describe("Office-TSV", () => {
  it("erhält Zellkoordinaten, Leerzellen, Leerzeichen und zitierte Zeilenumbrüche", () => {
    const result = parseOfficeTsv('\t B \t\r\n"mehr\r\n""Text"""\t\tEnde\r\n');
    if ("error" in result) throw new Error(result.error);
    expect(result).toMatchObject({ rows: 2, columns: 3 });
    const paragraph = (...content: object[]) => ({ type: "tableCell", attrs: {}, content: [{ type: "paragraph", ...(content.length && { content }) }] });
    const text = (value: string) => ({ type: "text", text: value });
    expect(result.table.content?.map((row) => row.content)).toEqual([
      [paragraph(), paragraph(text(" B ")), paragraph()],
      [paragraph(text("mehr"), { type: "hardBreak" }, text('"Text"')), paragraph(), paragraph(text("Ende"))],
    ]);
  });

  it.each([
    ["gewöhnlicher Text", /mehreren Zellen/],
    ["A\tB\nC", /gleich viele Spalten/],
    ['"offen\tB', /ungültig/],
    [Array.from({ length: OFFICE_TSV_LIMITS.rows + 1 }, () => "A\tB").join("\n"), /50 Zeilen/],
    [Array.from({ length: OFFICE_TSV_LIMITS.columns + 1 }, () => "A").join("\t"), /12 Spalten/],
    ["X".repeat(OFFICE_TSV_LIMITS.characters + 1), /32.000 Zeichen/],
  ])("meldet ununterstützte Eingaben", (input, reason) => {
    expect(parseOfficeTsv(input)).toHaveProperty("error", expect.stringMatching(reason));
  });

  it("lädt einfache Tabellen editierbar und erhält komplexe Tabellen und unbekannte Blöcke exakt", () => {
    const result = parseOfficeTsv('A\t\nB\t"Zeile\n2"');
    if ("error" in result) throw new Error(result.error);
    const complex = { ...result.table, attrs: { ...result.table.attrs, localId: "ursprünglich" } };
    const unknown = { type: "extension", attrs: { future: true } };
    const original = { type: "doc", version: 1, content: [unknown, complex, result.table] };
    const editor = adfToEditor(original, true);
    expect(editor.content?.map(({ type }) => type)).toEqual(["adfBlock", "adfBlock", "adfTable", "paragraph"]);
    const model = adfSchema.nodeFromJSON(editor);
    model.check();
    expect(editorToAdf(model.toJSON())).toEqual(original);
    expect(adfToEditor(original).content?.[2]?.type).toBe("adfBlock");
  });
});
