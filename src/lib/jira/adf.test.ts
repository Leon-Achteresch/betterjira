import { describe, expect, it } from "vitest";
import {
  adfSchema,
  adfToEditor,
  appendBlocks,
  editorToAdf,
  hasSendableContent,
  isBlankAdf,
  isEditableAdf,
  sameAdf,
  textToAdf,
  type AdfNode,
} from "./adf";

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

  it("bildet Erwähnungen als echten Mention-Knoten ab und behält alle ADF-Attribute", () => {
    const mentions: AdfNode = {
      type: "doc",
      version: 1,
      content: [
        paragraph(
          { type: "mention", attrs: { id: "abc", text: "@Leon", accessLevel: "", localId: "l-1", userType: "DEFAULT" } },
          text(" und "),
          { type: "mention", attrs: { id: "def", text: "Ohne At" } },
          { type: "mention", attrs: { id: "ghi" } },
        ),
      ],
    };
    expect(adfToEditor(mentions).content?.[0]?.content?.[0]).toMatchObject({ type: "mention", attrs: { id: "abc", label: "@Leon" } });
    expect(isEditableAdf(mentions)).toBe(true);
    expect(throughEditor(mentions)).toEqual(mentions);
  });

  it("bewahrt Erwähnungen mit fremden Attributen unverändert", () => {
    const odd: AdfNode = { type: "doc", version: 1, content: [paragraph({ type: "mention", attrs: { id: "abc", extra: 1 } })] };
    expect(adfToEditor(odd).content?.[0]?.content?.[0]?.type).toBe("adfInline");
    expect(throughEditor(odd)).toEqual(odd);
  });

  it("sendet neue Erwähnungen nur mit id und text", () => {
    const fromEditor = editorToAdf({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "mention", attrs: { id: "abc", label: "@Leon", mentionSuggestionChar: "@", localId: null } }] }],
    });
    expect(fromEditor.content?.[0]?.content?.[0]).toEqual({ type: "mention", attrs: { id: "abc", text: "@Leon" } });
  });

  it("erkennt sendbaren Inhalt", () => {
    expect(hasSendableContent({ type: "doc", content: [paragraph(text("  "))] })).toBe(false);
    expect(hasSendableContent({ type: "doc", content: [{ type: "paragraph" }] })).toBe(false);
    expect(hasSendableContent({ type: "doc", content: [paragraph(text(" x "))] })).toBe(true);
    expect(hasSendableContent({ type: "doc", content: [paragraph({ type: "mention", attrs: { id: "abc" } })] })).toBe(true);
  });

  it("macht aus Text je Zeile einen Absatz ohne Textverlust", () => {
    const converted = textToAdf("*fett*\r\n\n[~accountid:1]");
    expect(converted).toEqual({
      type: "doc",
      version: 1,
      content: [paragraph(text("*fett*")), { type: "paragraph" }, paragraph(text("[~accountid:1]"))],
    });
    expect(isEditableAdf(converted)).toBe(true);
  });

  it("hängt Blöcke an vorhandenen Inhalt an", () => {
    const existing: AdfNode = { type: "doc", version: 1, content: [paragraph(text("Notiz"))] };
    expect(appendBlocks(existing, [paragraph(text("Vorlage"))]).content).toEqual([paragraph(text("Notiz")), paragraph(text("Vorlage"))]);
    expect(appendBlocks({ type: "doc", content: [{ type: "paragraph" }] }, [paragraph(text("Vorlage"))]).content).toEqual([
      paragraph(text("Vorlage")),
    ]);
    expect(appendBlocks(undefined, [paragraph(text("V"))]).content).toEqual([paragraph(text("V"))]);
  });

  it("hält hinter einem Block am Ende eine Schreibzeile bereit und speichert sie nicht mit", () => {
    const media: AdfNode = { type: "mediaSingle", attrs: { layout: "center" }, content: [{ type: "media", attrs: { id: "u", type: "file", collection: "" } }] };
    const endsWithMedia: AdfNode = { type: "doc", version: 1, content: [paragraph(text("Bild:")), media] };
    const editor = adfToEditor(endsWithMedia);
    expect(editor.content?.at(-1)).toEqual({ type: "paragraph", attrs: { trailing: true } });
    expect(throughEditor(endsWithMedia)).toEqual(endsWithMedia);

    const typed = { ...editor, content: [...editor.content!.slice(0, -1), { type: "paragraph", attrs: { trailing: true }, content: [{ type: "text", text: "danach" }] }] };
    expect(editorToAdf(typed).content?.at(-1)).toEqual(paragraph(text("danach")));

    const ownEmptyLine: AdfNode = { type: "doc", version: 1, content: [media, { type: "paragraph" }] };
    expect(throughEditor(ownEmptyLine)).toEqual(ownEmptyLine);
  });

  it("wertet ein Bild allein als sendbaren Inhalt", () => {
    const media: AdfNode = { type: "mediaSingle", content: [{ type: "media", attrs: { id: "u", type: "file", collection: "" } }] };
    expect(hasSendableContent({ type: "doc", content: [media] })).toBe(true);
  });

  it("vergleicht Dokumente nach Inhalt", () => {
    expect(sameAdf(textToAdf("a"), textToAdf("a"))).toBe(true);
    expect(sameAdf(textToAdf("a"), textToAdf("b"))).toBe(false);
    expect(sameAdf(undefined, textToAdf("a"))).toBe(false);
  });
});
