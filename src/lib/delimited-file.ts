import { format as formatDate } from "date-fns";

export type DelimitedFormat = "csv" | "tsv";

const DELIMITERS: Record<DelimitedFormat, string> = { csv: ",", tsv: "\t" };

export const DELIMITED_MIME: Record<DelimitedFormat, string> = {
  csv: "text/csv;charset=utf-8",
  tsv: "text/tab-separated-values;charset=utf-8",
};

const BOM = "﻿";
const LINE_END = "\r\n";
const FORMULA_START = /^[\s\p{Cc}]*[=+\-@＝＋－＠]|^\p{Cc}/u;
const NEEDS_QUOTES = /[",;\t\r\n]/;

const neutralize = (value: string) => (FORMULA_START.test(value) ? `'${value}` : value);

const quote = (value: string) => (NEEDS_QUOTES.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export const toDelimitedFile = (
  format: DelimitedFormat,
  header: readonly string[],
  rows: readonly (readonly string[])[],
) =>
  BOM +
  [header, ...rows].map((row) => row.map((cell) => quote(neutralize(cell))).join(DELIMITERS[format]) + LINE_END).join("");

export const delimitedFileName = (format: DelimitedFormat, date: Date, selectedOnly: boolean) =>
  `jira-tickets${selectedOnly ? "-auswahl" : ""}-${formatDate(date, "yyyy-MM-dd")}.${format}`;
