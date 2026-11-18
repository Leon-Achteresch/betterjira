type TsvLimits = { characters: number; rows: number; columns?: number; rectangular?: boolean };
type TsvResult = { rows: string[][] } | { error: string };

export function parseTsv(input: string, limits: TsvLimits): TsvResult {
  if (input.length > limits.characters)
    return { error: `Die Tabelle darf höchstens ${limits.characters.toLocaleString("de-DE")} Zeichen enthalten.` };
  const cell = /(?:"((?:[^"]|"")*)"|([^"\t\r\n]*))(\t|\r\n?|\n|$)/y;
  const rows: string[][] = [];
  let row: string[] = [];
  for (;;) {
    const match = cell.exec(input);
    if (!match) return { error: `Die TSV-Zellen in Zeile ${rows.length + 1} sind ungültig.` };
    const [, quoted, plain, separator] = match;
    row.push(quoted === undefined ? plain ?? "" : quoted.replaceAll('""', '"'));
    if (limits.columns !== undefined && row.length > limits.columns)
      return { error: `Die Tabelle darf höchstens ${limits.columns} Spalten haben.` };
    if (separator === "\t") continue;
    if (limits.rectangular && rows[0] && row.length !== rows[0].length)
      return { error: "Alle TSV-Zeilen müssen gleich viele Spalten haben. Leere Zellen bitte mitkopieren." };
    rows.push(row);
    if (rows.length > limits.rows) return { error: `Die Tabelle darf höchstens ${limits.rows} Zeilen haben.` };
    if (cell.lastIndex === input.length) return { rows };
    row = [];
  }
}
