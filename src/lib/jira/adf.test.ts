import { describe, expect, it } from "vitest";
import { adfSchema, adfToEditor, editorToAdf, isBlankAdf, isEditableAdf, type AdfNode } from "./adf";

const sortMarks = (node: AdfNode): AdfNode => ({
  ...node,
  ...(node.marks && { marks: [...node.marks].sort((a, b) => a.type.localeCompare(b.type)) }),
  ...(node.content && { content: node.content.map(sortMarks) }),
});

const throughEditor = (doc: AdfNode) => editorToAdf(adfSchema.nodeFromJSON(adfToEditor(doc)).toJSON());

const text = (value: string, marks?: AdfNode["marks"]): AdfNode => ({ type: "text", text: value, ...(marks && { marks }) });
const paragraph = (...content: AdfNode[]): AdfNode => ({ type: "paragraph", content });

const doc: AdfNode = {
  type: "doc",
  version: 1,
  content: [
    { type: "heading", attrs: { level: 2 }, content: [text("Titel")] },
    paragraph(
      text("fett", [{ type: "strong" }, { type: "em" }]),
      text(" link", [{ type: "link", attrs: { href: "https://example.com" } }]),
      text(" farbig", [{ type: "textColor", attrs: { color: "#ff5630" } }, { type: "strong" }]),
      { type: "hardBreak" },
      { type: "mention", attrs: { id: "abc", text: "@Leon", accessLevel: "" } },
      { type: "emoji", attrs: { shortName: ":smile:", id: "1f604", text: "😄" } },
    ),
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            paragraph(text("eins")),
            { type: "bulletList", content: [{ type: "listItem", content: [paragraph(text("verschachtelt"))] }] },
          ],
        },
      ],
    },
    { type: "orderedList", attrs: { order: 3 }, content: [{ type: "listItem", content: [paragraph(text("drei"))] }] },
    { type: "codeBlock", attrs: { language: "ts" }, content: [text("const a = 1;")] },
    { type: "blockquote", content: [paragraph(text("Zitat"))] },
    { type: "rule" },
    { type: "paragraph", marks: [{ type: "alignment", attrs: { align: "center" } }], content: [text("zentriert")] },
    {
      type: "table",
      attrs: { isNumberColumnEnabled: false, layout: "default" },
      content: [{ type: "tableRow", content: [{ type: "tableCell", attrs: {}, content: [paragraph(text("Zelle"))] }] }],
    },
    { type: "panel", attrs: { panelType: "info" }, content: [paragraph(text("Hinweis"))] },
    { type: "paragraph" },
  ],
};

describe("ADF im Editor", () => {
  it("übersteht den Weg durch das Editor-Schema ohne Verlust", () => {
    expect(isEditableAdf(doc)).toBe(true);
    expect(sortMarks(throughEditor(doc))).toEqual(sortMarks(doc));
  });

  it("bewahrt unbekannte Knoten und Marks unverändert", () => {
    const editor = adfToEditor(doc);
    expect(editor.content?.find((node) => node.type === "adfBlock")?.attrs?.json).toBe(JSON.stringify(doc.content![7]));
    expect(JSON.stringify(editor)).toContain("adfMarks");
  });

  it("lehnt Strukturen ab, die der Editor nicht verlustfrei abbilden kann", () => {
    const listStartingWithCode: AdfNode = {
      type: "doc",
      version: 1,
      content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "codeBlock", content: [text("x")] }] }] }],
    };
    expect(isEditableAdf(listStartingWithCode)).toBe(false);
  });

  it("erkennt leere Dokumente", () => {
    expect(isBlankAdf({ type: "doc", content: [{ type: "paragraph" }] })).toBe(true);
    expect(isBlankAdf({ type: "doc", content: [] })).toBe(true);
    expect(isBlankAdf({ type: "doc", content: [{ type: "rule" }] })).toBe(false);
    expect(isBlankAdf({ type: "doc", content: [paragraph(text(" "))] })).toBe(false);
  });
});
