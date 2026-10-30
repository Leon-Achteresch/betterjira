const tsvCell = (value: string) => value.replace(/[\t\r\n]+/g, " ");

export const toTsv = (header: readonly string[], rows: readonly (readonly string[])[]) =>
  [header, ...rows].map((row) => row.map(tsvCell).join("\t")).join("\n");

const markdownCell = (value: string) => value.replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|") || " ";

export const toMarkdown = (header: readonly string[], rows: readonly (readonly string[])[]) =>
  [header, header.map(() => "---"), ...rows].map((row) => `| ${row.map(markdownCell).join(" | ")} |`).join("\n");
