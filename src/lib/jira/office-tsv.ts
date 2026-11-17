import type { AdfNode } from "./adf";
import { parseTsv } from "../tsv";

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
  const parsed = parseTsv(input, { ...OFFICE_TSV_LIMITS, rectangular: true });
  if ("error" in parsed) return parsed;
  const { rows } = parsed;
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
