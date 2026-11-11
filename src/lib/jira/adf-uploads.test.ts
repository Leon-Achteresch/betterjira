import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { describe, expect, it } from "vitest";
import { AdfBlock, AdfInline, AdfMarks, AdfMention, AdfStarterKit, AdfTrailingParagraph, adfToEditor, editorToAdf, type AdfNode } from "./adf";
import { imageMediaSingle } from "./adf-media";
import { AdfUploadPlaceholder, finishUploadPlaceholder, startUploadPlaceholder, uploadPlaceholderPos } from "./adf-uploads";
import { attachmentContentUrl, attachmentLinkNode, fileMediaInline } from "./attachment-link";

const schema = getSchema([AdfStarterKit, AdfInline, AdfBlock, AdfMarks, AdfMention, AdfTrailingParagraph, AdfUploadPlaceholder]);
const plugins = [AdfTrailingParagraph, AdfUploadPlaceholder].flatMap((extension) => extension.config.addProseMirrorPlugins?.call({} as never) ?? []);

const doc = (...lines: string[]): AdfNode => ({
  type: "doc",
  version: 1,
  content: lines.map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })),
});

const viewOf = (content: AdfNode, cursor: number) => {
  const initial = EditorState.create({ schema, doc: schema.nodeFromJSON(adfToEditor(content)), plugins });
  const view = {
    state: initial.apply(initial.tr.setSelection(TextSelection.create(initial.doc, cursor))),
    isDestroyed: false,
    dispatch(tr: Transaction) {
      view.state = view.state.apply(tr);
    },
  };
  return view as unknown as EditorView;
};

const start = (view: EditorView, pos: number) => {
  Object.assign(globalThis, { document: { createElement: () => ({ dataset: {}, setAttribute: () => undefined, classList: { add: () => undefined } }) } });
  return startUploadPlaceholder(view, pos, "shot.png", undefined);
};

const types = (view: EditorView) => editorToAdf(view.state.doc.toJSON()).content?.map((node) => node.type);

describe("Platzhalter für hochladende Dateien", () => {
  it("setzt das Bild an die Stelle des Platzhalters und den Cursor in die Zeile dahinter", () => {
    const view = viewOf(doc("Vorher"), 7);
    const id = start(view, 7);
    expect(uploadPlaceholderPos(view.state, id)).toBe(7);
    finishUploadPlaceholder(view, id, imageMediaSingle("u-1", "shot.png"));

    expect(uploadPlaceholderPos(view.state, id)).toBeUndefined();
    expect(view.state.doc.content.content.map((node) => node.type.name)).toEqual(["paragraph", "adfBlock", "paragraph"]);
    expect(view.state.selection.$from.parent).toBe(view.state.doc.lastChild);
    expect(types(view)).toEqual(["paragraph", "mediaSingle"]);
  });

  it("folgt Text, der während des Uploads davor getippt wird, und lässt einen wegbewegten Cursor stehen", () => {
    const view = viewOf(doc("ab"), 2);
    const id = start(view, 2);
    view.dispatch(view.state.tr.insertText("X", 1));
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
    finishUploadPlaceholder(view, id, imageMediaSingle("u-1", "shot.png"));

    const adf = editorToAdf(view.state.doc.toJSON());
    expect(adf.content?.map((node) => node.type)).toEqual(["paragraph", "mediaSingle", "paragraph"]);
    expect(adf.content?.[0]?.content?.[0]?.text).toBe("Xa");
    expect(adf.content?.[2]?.content?.[0]?.text).toBe("b");
    expect(view.state.selection.from).toBe(1);
  });

  it("räumt den Platzhalter ohne Knoten ab, wenn der Upload nichts einfügt", () => {
    const view = viewOf(doc("Text"), 3);
    const id = start(view, 3);
    finishUploadPlaceholder(view, id, null);
    expect(uploadPlaceholderPos(view.state, id)).toBeUndefined();
    expect(editorToAdf(view.state.doc.toJSON())).toEqual(doc("Text"));
  });

  it("setzt Dateichip und Link in die Zeile und lässt dahinter ein unverlinktes Leerzeichen", () => {
    const href = attachmentContentUrl("https://example.atlassian.net", "46887");
    const view = viewOf(doc("Siehe "), 7);
    finishUploadPlaceholder(view, start(view, 7), fileMediaInline("u-2", "Angebot.pdf"));
    finishUploadPlaceholder(view, start(view, view.state.selection.from), attachmentLinkNode("export.csv", href));

    expect(href).toBe("https://example.atlassian.net/rest/api/3/attachment/content/46887");
    expect(editorToAdf(view.state.doc.toJSON()).content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Siehe " },
          { type: "mediaInline", attrs: { id: "u-2", type: "file", collection: "", alt: "Angebot.pdf" } },
          { type: "text", text: " " },
          { type: "text", text: "export.csv", marks: [{ type: "link", attrs: { href } }] },
          { type: "text", text: " " },
        ],
      },
    ]);
    expect(view.state.selection.from).toBe(view.state.doc.content.size - 1);
  });
});
