import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import {
  FieldDrafts,
  clearSubmittedFieldDraft,
  fieldDraftId,
  removeFieldDraft,
  replaceFieldDraft,
} from "./field-draft";

describe("Feldentwürfe", () => {
  it("trennt Instanz, Konto, Ticket und Feld", () => {
    const base = fieldDraftId("cloud", "user", "A-1", "summary");
    expect(fieldDraftId("other", "user", "A-1", "summary")).not.toBe(base);
    expect(fieldDraftId("cloud", "other", "A-1", "summary")).not.toBe(base);
    expect(fieldDraftId("cloud", "user", "A-2", "summary")).not.toBe(base);
    expect(fieldDraftId("cloud", "user", "A-1", "description")).not.toBe(base);
    expect(fieldDraftId("cloud:a", "user", "A-1", "summary")).not.toBe(
      fieldDraftId("cloud", "a:user", "A-1", "summary"),
    );
  });

  it("behält auch bewusst leere Feldwerte als Entwurf", () => {
    const drafts = replaceFieldDraft({}, "a", "", "revision-1");
    expect(drafts.a).toEqual({ text: "", revision: "revision-1" });
    expect(Schema.is(FieldDrafts)(JSON.parse(JSON.stringify(drafts)))).toBe(true);
  });

  it("verwirft nur den gewählten Feldentwurf", () => {
    const drafts = replaceFieldDraft(replaceFieldDraft({}, "a", "A", "1"), "b", "B", "2");
    expect(removeFieldDraft(drafts, "a")).toEqual({ b: drafts.b });
    expect(drafts.a?.text).toBe("A");
  });

  it("entfernt nach erfolgreichem Speichern exakt die gesendete Revision", () => {
    const submitted = { text: "Text", revision: "revision-1" };
    expect(clearSubmittedFieldDraft({ a: submitted }, "a", submitted)).toEqual({});
  });

  it("behält während des Speicherns neu geschriebenen Text", () => {
    const submitted = { text: "Alter Text", revision: "revision-1" };
    const drafts = replaceFieldDraft({ a: submitted }, "a", "Neuer Text", "revision-2");
    expect(clearSubmittedFieldDraft(drafts, "a", submitted)).toBe(drafts);
  });

  it("behält auch einen neuen Entwurf mit demselben Text", () => {
    const submitted = { text: "Text", revision: "revision-1" };
    const drafts = replaceFieldDraft({}, "a", "Text", "revision-2");
    expect(clearSubmittedFieldDraft(drafts, "a", submitted)).toBe(drafts);
  });

  it("weist beschädigte gespeicherte Daten zurück", () => {
    expect(Schema.is(FieldDrafts)({ a: { text: "Text", revision: "1" } })).toBe(true);
    expect(Schema.is(FieldDrafts)({ a: { text: 12, revision: "1" } })).toBe(false);
    expect(Schema.is(FieldDrafts)({ a: { text: "Text" } })).toBe(false);
  });
});
