import { describe, expect, it } from "vitest";
import { plainDescription } from "./adf-plain-text";

const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, ...(marks && { marks }) });
const link = (href: string) => ({ type: "link", attrs: { href } });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const item = (...content: unknown[]) => ({ type: "listItem", content });
const doc = (...content: unknown[]) => ({ type: "doc", version: 1, content });

const textOf = (value: unknown) => {
  const result = plainDescription(value);
  if (result.kind !== "text") throw new Error(`kein Text: ${result.kind}`);
  return result.text;
};

describe("plainDescription", () => {
  it("hält Textgrenzen: angrenzende Textknoten, Absätze und harte Umbrüche", () => {
    expect(
      textOf(
        doc(
          { type: "heading", attrs: { level: 2 }, content: [text("Titel")] },
          paragraph(text("Wort"), text("teil", [{ type: "strong" }]), text("  bleibt  "), text("farbig", [{ type: "textColor", attrs: { color: "#f00" } }])),
          paragraph(),
          paragraph(text("Zeile 1 "), { type: "hardBreak" }, text("Zeile 2")),
        ),
      ),
    ).toBe("Titel\n\nWortteil  bleibt  farbig\n\nZeile 1\nZeile 2");
  });

  it("nennt Linkziele einmal je Link und nur, wenn der Text sie nicht schon zeigt", () => {
    expect(
      textOf(
        doc(
          paragraph(
            text("Siehe "),
            text("Doku", [link("https://example.test/doku"), { type: "strong" }]),
            text("mentation", [link("https://example.test/doku")]),
            text(" und "),
            text("https://example.test/a", [link("https://example.test/a")]),
            text(" oder "),
            text("qa@example.test", [link("mailto:qa@example.test")]),
            text("."),
          ),
        ),
      ),
    ).toBe("Siehe Dokumentation (https://example.test/doku) und https://example.test/a oder qa@example.test.");
  });

  it("gibt Erwähnungen, Emojis, Status, Datum und Karten lesbar wieder", () => {
    expect(
      textOf(
        doc(
          paragraph(
            { type: "mention", attrs: { id: "acc-1", text: "@Alex Beispiel" } },
            text(" und "),
            { type: "mention", attrs: { id: "acc-2", text: "Sam" } },
            text(": "),
            { type: "emoji", attrs: { shortName: ":smile:", text: "😄" } },
            { type: "emoji", attrs: { shortName: ":qa:" } },
            text(" "),
            { type: "status", attrs: { text: "IN ARBEIT", color: "yellow" } },
            text(" bis "),
            { type: "date", attrs: { timestamp: "1793836800000" } },
            text(" "),
            { type: "inlineCard", attrs: { url: "https://example.test/browse/DEMO-2" } },
          ),
        ),
      ),
    ).toBe("@Alex Beispiel und @Sam: 😄:qa: IN ARBEIT bis 5.11.2026 https://example.test/browse/DEMO-2");
  });

  it("formatiert verschachtelte, nummerierte und Aufgabenlisten", () => {
    expect(
      textOf(
        doc(
          {
            type: "bulletList",
            content: [item(paragraph(text("eins")), { type: "bulletList", content: [item(paragraph(text("verschachtelt")))] }), item(paragraph(text("zwei")))],
          },
          {
            type: "orderedList",
            attrs: { order: 3 },
            content: [item(paragraph(text("drei"))), item(paragraph(text("vier"), { type: "hardBreak" }, text("weiter")))],
          },
          {
            type: "taskList",
            content: [
              { type: "taskItem", attrs: { state: "DONE" }, content: [text("erledigt")] },
              { type: "taskItem", attrs: { state: "TODO" }, content: [text("offen")] },
            ],
          },
        ),
      ),
    ).toBe("- eins\n  - verschachtelt\n- zwei\n\n3. drei\n4. vier\n   weiter\n\n[x] erledigt\n[ ] offen");
  });

  it("gibt Zitate, Code, Trenner, Tabellen und Panels als Text aus", () => {
    expect(
      textOf(
        doc(
          { type: "blockquote", content: [paragraph(text("Zitat a")), paragraph(text("Zitat b"))] },
          { type: "codeBlock", attrs: { language: "ts" }, content: [text("const a = 1;\nconst b = 2;")] },
          { type: "rule" },
          {
            type: "table",
            content: [
              { type: "tableRow", content: [{ type: "tableHeader", content: [paragraph(text("Feld"))] }, { type: "tableHeader", content: [paragraph(text("Wert"))] }] },
              { type: "tableRow", content: [{ type: "tableCell", content: [paragraph(text("Status"))] }, { type: "tableCell", content: [paragraph(text("Offen")), paragraph(text("seit gestern"))] }] },
            ],
          },
          { type: "panel", attrs: { panelType: "info" }, content: [paragraph(text("Hinweis"))] },
        ),
      ),
    ).toBe("> Zitat a\n\n> Zitat b\n\nconst a = 1;\nconst b = 2;\n\n---\n\nFeld | Wert\nStatus | Offen seit gestern\n\nHinweis");
  });

  it("kopiert aus unbekannten Blöcken nur enthaltenen Text, nie Attribute oder JSON", () => {
    const secret = { token: "geheim-123", json: '{"a":1}' };
    const result = textOf(
      doc(
        paragraph(text("Vor")),
        { type: "extension", attrs: { extensionKey: "makro", parameters: secret } },
        { type: "bodiedExtension", attrs: { parameters: secret }, content: [paragraph(text("Innen"))] },
        { type: "mediaSingle", content: [{ type: "media", attrs: { id: "media-geheim", type: "file" } }] },
        { type: "layoutSection", content: [{ type: "layoutColumn", attrs: { width: 50 }, content: [paragraph(text("Spalte"))] }] },
        { type: "zukunftsblock", attrs: secret, content: [text("neu")] },
        paragraph(text("Text "), { type: "inlineExtension", attrs: secret }, { type: "placeholder", attrs: { text: "Platzhalter" } }),
      ),
    );
    expect(result).toBe("Vor\n\nInnen\n\nSpalte\n\nneu\n\nText");
    expect(result).not.toMatch(/[{}]|geheim|makro|Platzhalter/);
  });

  it("übernimmt gespeicherten Klartext und normalisiert Zeilenenden", () => {
    expect(textOf("  Wiki *Text*\r\nZeile  \r\n")).toBe("Wiki *Text*\nZeile");
  });

  it("verträgt ungültige Datumswerte und liest Text unbekannter Knoten ohne deren Attribute", () => {
    expect(textOf(doc(paragraph(text("Text"), { type: "date", attrs: { timestamp: "1e100" } })))).toBe("Text");
    expect(textOf(doc({ type: "futureText", text: "Lesbarer Text", attrs: { secret: "nicht kopieren" } }))).toBe("Lesbarer Text");
  });

  it("unterscheidet fehlende, leere und unlesbare Beschreibungen", () => {
    expect(plainDescription(null)).toEqual({ kind: "missing" });
    expect(plainDescription(undefined)).toEqual({ kind: "missing" });
    for (const blank of [doc(), { type: "doc" }, doc(paragraph()), doc(paragraph(text("  "), { type: "hardBreak" }, text(" "))), "  \n ", doc({ type: "mediaSingle", content: [{ type: "media", attrs: { id: "m" } }] })]) {
      expect(plainDescription(blank)).toEqual({ kind: "blank" });
    }
    for (const unreadable of [42, [], { foo: 1 }, { type: "paragraph" }, { type: "doc", content: "x" }, doc(paragraph({ type: "text", text: 5 })), doc({ content: [] }), doc(paragraph(text("a", [{ attrs: {} }])))]) {
      expect(plainDescription(unreadable)).toEqual({ kind: "unreadable" });
    }
  });
});
