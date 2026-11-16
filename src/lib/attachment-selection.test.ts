import { describe, expect, it } from "vitest";
import fixture from "../../tests/jira/fixtures/attachment-selection.json";
import { emptyAttachmentSelection, reconcileAttachmentSelection, type AttachmentSelection } from "./attachment-selection";

const files = fixture.attachments;
const context = JSON.stringify(["site", "me", "DEMO-1", "", "all"]);
const selected = (): AttachmentSelection => ({ context, selecting: true, ids: ["11", "13"], confirmation: [files[0], files[2]], results: [] });

describe("Sichtauswahl und Bestaetigung", () => {
  it("behaelt dieselbe bestaetigte Dateimenge bei Sortierung und unveraendertem Kontext", () => {
    const state = selected();
    expect(reconcileAttachmentSelection(state, context, [...files].reverse())).toBe(state);
  });

  it.each([
    ["other-site", "me", "DEMO-1", "", "all"], ["site", "other", "DEMO-1", "", "all"],
    ["site", "me", "DEMO-2", "", "all"], ["site", "me", "DEMO-1", "png", "all"], ["site", "me", "DEMO-1", "", "document"],
  ])("leert Auswahl und Bestaetigung beim Kontextwechsel %j", (...parts) => {
    const next = JSON.stringify(parts);
    expect(reconcileAttachmentSelection(selected(), next, files)).toEqual(emptyAttachmentSelection(next));
    expect(reconcileAttachmentSelection(selected(), next, files, true)).toEqual(emptyAttachmentSelection(next));
  });

  it("entfernt verschwundene oder nicht mehr berechtigte IDs und bestaetigt sie nicht still neu", () => {
    const result = reconcileAttachmentSelection(selected(), context, [files[0]]);
    expect(result.ids).toEqual(["11"]);
    expect(result.confirmation).toBeNull();
    expect(reconcileAttachmentSelection(result, context, files).ids).toEqual(["11"]);
  });

  it("verwirft die Bestaetigung bei geaenderten Metadaten derselben ID", () => {
    const result = reconcileAttachmentSelection(selected(), context, [{ ...files[0], size: 999 }, files[2]]);
    expect(result.confirmation).toBeNull();
    expect(result.ids).toEqual(["11", "13"]);
  });

  it("haelt die bereits gesendete Momentaufnahme waehrend des Laufs fest", () => {
    const state = selected();
    expect(reconcileAttachmentSelection(state, context, [], true)).toBe(state);
  });
});
