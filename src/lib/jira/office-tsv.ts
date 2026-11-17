import type { AdfNode } from "./adf";

export const OFFICE_TSV_LIMITS = { characters: 32_000, rows: 50, columns: 12 } as const;

type OfficeTsv = { table: AdfNode; rows: number; columns: number } | { error: string };

const cellContent = (value: string): AdfNode => {
  const content = value.split(/\r\n?|\n/).flatMap<AdfNode>((line, index) => [
    ...(index ? [{ type: "hardBreak" }] : []),
    ...(line ? [{ type: "text", text: line }] : []),
  ]);
  return { type: "paragraph", ...(content.length > 0 && { content }) };
};

export function parseOfficeTsv(input: string): OfficeTsv {
  if (input.length > OFFICE_TSV_LIMITS.characters) return { error: "Die Tabelle darf höchstens 32.000 Zeichen enthalten." };
  const cell = /(?:"((?:[^"]|"")*)"|([^"\t\r\n]*))(\t|\r\n?|\n|$)/y;
  const rows: string[][] = [];
  let row: string[] = [];
  for (;;) {
    const match = cell.exec(input);
    if (!match) return { error: "Die TSV-Zellen sind ungültig. Kopiere den Zellbereich erneut aus der Tabelle." };
    const [, quoted, plain, separator] = match;
    row.push(quoted === undefined ? plain ?? "" : quoted.replaceAll('""', '"'));
    if (row.length > OFFICE_TSV_LIMITS.columns) return { error: "Die Tabelle darf höchstens 12 Spalten haben." };
    if (separator === "\t") continue;
    if (rows[0] && row.length !== rows[0].length) return { error: "Alle TSV-Zeilen müssen gleich viele Spalten haben. Leere Zellen bitte mitkopieren." };
    rows.push(row);
    if (rows.length > OFFICE_TSV_LIMITS.rows) return { error: "Die Tabelle darf höchstens 50 Zeilen haben." };
    if (cell.lastIndex === input.length) break;
    row = [];
  }
  const columns = rows[0]?.length ?? 0;
  if (rows.length === 1 && columns < 2) return { error: "Füge einen tabulatorgetrennten Zellbereich mit mehreren Zellen ein." };
  return {
    rows: rows.length,
    columns,
    table: {
      type: "table",
      attrs: { isNumberColumnEnabled: false, layout: "default" },
      content: rows.map((values) => ({
        type: "tableRow",
        content: values.map((value) => ({ type: "tableCell", attrs: {}, content: [cellContent(value)] })),
      })),
    },
  };
}
