import { describe, expect, it } from "vitest";
import { adfToEditor, editorToAdf, type AdfNode } from "./adf";
import type { IssueComment } from "./comment-thread";
import {
  canSaveEdit,
  commentEditAction,
  editableCommentIds,
  editBaseline,
  editBlockReason,
  editDraftToKeep,
  editErrorFor,
  prunableEditIds,
  saveFailureNotice,
} from "./comment-edit";

const text = (value: string): AdfNode => ({ type: "text", text: value });
const paragraph = (...content: AdfNode[]): AdfNode => ({ type: "paragraph", content });
const doc = (...content: AdfNode[]): AdfNode => ({ type: "doc", version: 1, content });
const body = doc(paragraph(text("Hallo")));
const locked = doc({ type: "bulletList", content: [{ type: "listItem", content: [{ type: "codeBlock", content: [text("x")] }] }] });

describe("gemeinsame Bearbeitungsaktion für Kopf und Kommentarende", () => {
  const comment = { id: "10", body, created: "2026-11-01T10:00:00Z" };

  it.each([[false, false], [false, true], [true, false]])("bietet bei confirmed=%s und canEdit=%s keine Aktion an", (confirmed, canEdit) => {
    expect(commentEditAction(comment, { confirmed, canEdit, label: "Bearbeiten", onEdit: () => undefined })).toBeUndefined();
  });

  it("bindet genau den gewählten Kommentar an den vorhandenen Editorcallback", () => {
    const targets: IssueComment[] = [];
    const reply = { ...comment, id: "11", parentId: comment.id };
    const onEdit = (target: IssueComment) => { targets.push(target); };
    const rootAction = commentEditAction(comment, { confirmed: true, canEdit: true, label: "Bearbeiten", onEdit });
    const replyAction = commentEditAction(reply, { confirmed: true, canEdit: true, label: "Bearbeiten", onEdit });
    replyAction?.onSelect();
    rootAction?.onSelect();
    expect(targets).toEqual([reply, comment]);
    expect(targets[0]).toBe(reply);
  });

  it("erhält Beschriftung und Sperrgrund für Menü und Textende", () => {
    const action = commentEditAction(comment, { confirmed: true, canEdit: true, label: "Bearbeitung fortsetzen", disabledReason: "Nur in Jira bearbeitbar", onEdit: () => undefined });
    expect(action).toMatchObject({ label: "Bearbeitung fortsetzen", disabledReason: "Nur in Jira bearbeitbar" });
  });
});

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

  it("bereinigt Bearbeitungsentwürfe nur, wenn die Kommentarliste vollständig geladen ist", () => {
    const comments = [{ id: "1", body }, { id: "2", body: locked }];
    expect(prunableEditIds({ comments, next: 50, incomplete: false, loading: false })).toBeUndefined();
    expect(prunableEditIds({ comments, incomplete: true, loading: false })).toBeUndefined();
    expect(prunableEditIds({ comments, next: 0, incomplete: true, loading: false })).toBeUndefined();
    expect(prunableEditIds({ comments, incomplete: false, loading: false })).toEqual(["1"]);
    expect(prunableEditIds({ comments: [], incomplete: false, loading: false })).toEqual([]);
  });

  it("bereinigt nicht, solange die Liste lädt oder Jira weniger als total liefert", () => {
    const comments = [{ id: "1", body }];
    expect(prunableEditIds({ comments, incomplete: false, loading: true })).toBeUndefined();
    expect(prunableEditIds({ comments, incomplete: true, loading: true })).toBeUndefined();
    expect(prunableEditIds({ comments, incomplete: true, loading: false })).toBeUndefined();
  });
});
