import { describe, expect, it } from "vitest";
import { adfToEditor, editorToAdf, type AdfNode } from "./adf";
import {
  canSaveEdit,
  editableCommentIds,
  editBaseline,
  editBlockReason,
  editDraftToKeep,
  editErrorFor,
  saveFailureNotice,
} from "./comment-edit";

const text = (value: string): AdfNode => ({ type: "text", text: value });
const paragraph = (...content: AdfNode[]): AdfNode => ({ type: "paragraph", content });
const doc = (...content: AdfNode[]): AdfNode => ({ type: "doc", version: 1, content });
const body = doc(paragraph(text("Hallo")));
const locked = doc({ type: "bulletList", content: [{ type: "listItem", content: [{ type: "codeBlock", content: [text("x")] }] }] });

describe("Kommentar bearbeiten", () => {
  it("nimmt als Vergleichsbasis den Kommentar nach Hin- und Rückwandlung", () => {
    expect(editBaseline(body)).toEqual(editorToAdf(adfToEditor(body)));
    expect(editBaseline(locked)).toBeUndefined();
    expect(editBaseline("kein ADF")).toBeUndefined();
  });

  it("sperrt Speichern bei gleichem Inhalt, nur Leerraum, laufendem Speichern oder fehlender Basis", () => {
    const baseline = editBaseline(body);
    expect(canSaveEdit(baseline, baseline, false)).toBe(false);
    expect(canSaveEdit(doc(paragraph(text("   "))), baseline, false)).toBe(false);
    expect(canSaveEdit(doc(paragraph(text("Neu"))), baseline, true)).toBe(false);
    expect(canSaveEdit(doc(paragraph(text("Neu"))), undefined, false)).toBe(false);
    expect(canSaveEdit(undefined, baseline, false)).toBe(false);
    expect(canSaveEdit(doc(paragraph(text("Neu"))), baseline, false)).toBe(true);
    expect(canSaveEdit(doc(paragraph({ type: "mention", attrs: { id: "a", text: "@A" } })), baseline, false)).toBe(true);
  });

  it("behält beim Schließen nur Inhalt, der nicht leer ist und vom Kommentar abweicht", () => {
    const baseline = editBaseline(body);
    expect(editDraftToKeep(doc(paragraph(text("Neu"))), baseline)).toEqual(doc(paragraph(text("Neu"))));
    expect(editDraftToKeep(baseline, baseline)).toBeUndefined();
    expect(editDraftToKeep(doc({ type: "paragraph" }), baseline)).toBeUndefined();
    expect(editDraftToKeep(undefined, baseline)).toBeUndefined();
  });

  it("nennt den Grund, wenn sich der Inhalt nur in Jira bearbeiten lässt", () => {
    expect(editBlockReason(body)).toBeUndefined();
    expect(editBlockReason(locked)).toBe("Enthält Inhalte, die sich nur in Jira bearbeiten lassen");
  });

  it("behält Entwürfe nur für Kommentare, die sich hier noch bearbeiten lassen", () => {
    const comments = [
      { id: "1", body },
      { id: "2", body: locked },
      { id: "3", body: "kein ADF" },
      { id: "4", body: doc(paragraph(text("Neu"))) },
    ];
    expect(editableCommentIds(comments)).toEqual(["1", "4"]);
    expect(editableCommentIds([])).toEqual([]);
  });

  it("zeigt einen Speicherfehler nur im Editor des gescheiterten Kommentars", () => {
    expect(editErrorFor("10", "10", "Jira antwortet mit 503")).toBe("Jira antwortet mit 503");
    expect(editErrorFor("11", "10", "Jira antwortet mit 503")).toBeUndefined();
    expect(editErrorFor(undefined, undefined, "Jira antwortet mit 503")).toBeUndefined();
    expect(saveFailureNotice("10", "10")).toBe("inline");
    expect(saveFailureNotice("11", "10")).toBe("toast");
    expect(saveFailureNotice(undefined, "10")).toBe("toast");
  });
});
