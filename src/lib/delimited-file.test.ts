import { describe, expect, it } from "vitest";
import { delimitedFileName, toDelimitedFile } from "./delimited-file";

const lines = (content: string) => content.slice(1).split("\r\n");

describe("toDelimitedFile", () => {
  it("beginnt mit BOM und endet jede Zeile mit CRLF", () => {
    const content = toDelimitedFile("csv", ["Schlüssel", "Titel"], [["DEMO-1", "Grüße 👋"]]);
    expect(content.startsWith("﻿")).toBe(true);
    expect(content).toBe("﻿Schlüssel,Titel\r\nDEMO-1,Grüße 👋\r\n");
  });

  it("setzt Komma, Semikolon, Tab, Anführungszeichen und Zeilenumbrüche in Anführungszeichen", () => {
    const row = ["a,b", "a;b", "a\tb", 'sagt "hallo"', "eins\nzwei", "eins\r\nzwei", "schlicht"];
    expect(toDelimitedFile("csv", ["x", "y", "z", "q", "n", "r", "s"], [row])).toBe(
      '﻿x,y,z,q,n,r,s\r\n"a,b","a;b","a\tb","sagt ""hallo""","eins\nzwei","eins\r\nzwei",schlicht\r\n',
    );
  });

  it("trennt TSV mit Tab und quotet nach denselben Regeln", () => {
    expect(toDelimitedFile("tsv", ["A", "B"], [["x,y", "a\tb"]])).toBe('﻿A\tB\r\n"x,y"\t"a\tb"\r\n');
  });

  it.each([
    ["=HYPERLINK(\"x\")", "\"'=HYPERLINK(\"\"x\"\")\""],
    ["+1", "'+1"],
    ["-2", "'-2"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["  =1+1", "'  =1+1"],
    ["\t=1", "\"'\t=1\""],
    ["\r=1", "\"'\r=1\""],
    ["\u0001x", "'\u0001x"],
    ["＝1", "'＝1"],
    ["a=b", "a=b"],
    ["E-Mail", "E-Mail"],
  ])("neutralisiert Formelbeginn %j", (cell, expected) => {
    expect(lines(toDelimitedFile("csv", ["h"], [[cell]]))[1]).toBe(expected);
  });

  it("neutralisiert auch Kopfzeilen", () => {
    expect(lines(toDelimitedFile("tsv", ["=Spalte", "-Minus"], []))[0]).toBe("'=Spalte\t'-Minus");
  });

  it("behält leere Zellen und leere Zeilen in fester Spaltenreihenfolge", () => {
    const content = toDelimitedFile("csv", ["Schlüssel", "Bearbeiter", "Status"], [["DEMO-1", "", "Offen"], ["", "", ""]]);
    expect(lines(content)).toEqual(["Schlüssel,Bearbeiter,Status", "DEMO-1,,Offen", ",,", ""]);
  });

  it("liefert ohne Zeilen nur die Kopfzeile", () => {
    expect(toDelimitedFile("csv", ["A"], [])).toBe("﻿A\r\n");
  });
});

describe("delimitedFileName", () => {
  const date = new Date(2026, 10, 6, 23, 30);

  it("benennt nach Datum ohne Abfrage", () => {
    expect(delimitedFileName("csv", date, false)).toBe("jira-tickets-2026-11-06.csv");
    expect(delimitedFileName("tsv", date, true)).toBe("jira-tickets-auswahl-2026-11-06.tsv");
  });
});
