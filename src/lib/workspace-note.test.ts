import { describe, expect, it } from "vitest";
import { EMPTY_WORKSPACE, rememberIssue, setCommentDraft, setIssueContext, togglePinnedIssue, workspaceId } from "./workspace";
import {
  activeNoteEdit,
  noteConflict,
  noteFocusKey,
  normalizedNote,
  restoreNote,
  storedNote,
  writeNote,
  type NoteEdit,
} from "./workspace-note";

const own = workspaceId("qa-cloud", "qa-user");
const colleague = workspaceId("qa-cloud", "qa-colleague");

const busy = () => {
  let workspace = rememberIssue(
    EMPTY_WORKSPACE,
    { key: "A-1", summary: "Suche" },
    { note: "Alt", scrollTop: 640, visitedAt: 7, statusName: "In Arbeit", statusColor: "yellow" },
  );
  workspace = togglePinnedIssue(workspace, { key: "A-1", summary: "Suche" });
  return setCommentDraft(workspace, "A-1", "Kommentarentwurf");
};

describe("Notiz-Bearbeitung: Scope", () => {
  const edit: NoteEdit = { scope: own, key: "A-1", base: "Alt" };

  it("gilt nur im Konto, in dem sie begonnen wurde", () => {
    expect(activeNoteEdit(edit, own)).toBe(edit);
    expect(activeNoteEdit(edit, colleague)).toBeNull();
    expect(activeNoteEdit(edit, undefined)).toBeNull();
    expect(activeNoteEdit(null, own)).toBeNull();
  });

  it("ist nach dem Schließen nicht mehr aktiv", () => {
    expect(activeNoteEdit({ ...edit, closed: true }, own)).toBeNull();
  });
});

describe("Notiz-Bearbeitung: Konflikt", () => {
  it("meldet nur echte Änderungen im Speicher", () => {
    expect(noteConflict("Alt", "Alt", "Neu")).toBeNull();
    expect(noteConflict("Alt", "Woanders", "Neu")).toBe("Woanders");
    expect(noteConflict("Alt", "", "Neu")).toBe("");
  });

  it("ist kein Konflikt, wenn der Speicher schon dem Entwurf entspricht", () => {
    expect(noteConflict("Alt", "Neu", "Neu")).toBeNull();
  });
});

describe("Notiz schreiben", () => {
  it("ändert nur die Notiz und bewahrt alle anderen Felder", () => {
    const before = busy();
    const after = writeNote(before, "A-1", "Neu");
    expect(storedNote(after, "A-1")).toBe("Neu");
    expect(after.contexts?.["A-1"]).toEqual({ ...before.contexts?.["A-1"], note: "Neu" });
    expect({ ...after, contexts: before.contexts }).toEqual(before);
  });

  it("lässt den Speicher unverändert, wenn sich nichts ändert", () => {
    const before = busy();
    expect(writeNote(before, "A-1", "Alt")).toBe(before);
  });

  it("entfernt bei leerem Text nur die Notiz", () => {
    expect(normalizedNote("  \n ")).toBe("");
    expect(normalizedNote(" Text ")).toBe(" Text ");
    const after = writeNote(busy(), "A-1", normalizedNote("   "));
    expect(after.contexts?.["A-1"]).toMatchObject({ note: "", scrollTop: 640, visitedAt: 7, statusName: "In Arbeit" });
    expect(after.drafts["A-1"]).toBe("Kommentarentwurf");
    expect(after.pinned).toEqual([{ key: "A-1", summary: "Suche" }]);
  });

  it("Rückgängig stellt die Notiz wieder her, überschreibt aber keine neuere", () => {
    const cleared = writeNote(busy(), "A-1", "");
    expect(storedNote(restoreNote(cleared, "A-1", "Alt"), "A-1")).toBe("Alt");
    const rewritten = setIssueContext(cleared, "A-1", { note: "Neuer" });
    expect(restoreNote(rewritten, "A-1", "Alt")).toBe(rewritten);
  });
});

describe("Fokus nach dem Schließen", () => {
  const order = ["A", "B", "C"];

  it("bleibt auf der Zeile, solange sie sichtbar ist", () => {
    expect(noteFocusKey(order, order, "B")).toEqual({ key: "B", removed: false });
  });

  it("springt zur nächsten, sonst vorherigen Zeile, wenn der Filter sie entfernt", () => {
    expect(noteFocusKey(order, ["A", "C"], "B")).toEqual({ key: "C", removed: true });
    expect(noteFocusKey(order, ["A", "B"], "C")).toEqual({ key: "B", removed: true });
    expect(noteFocusKey(order, ["X"], "B")).toEqual({ key: "X", removed: true });
  });

  it("liefert nichts, wenn keine Zeile übrig ist", () => {
    expect(noteFocusKey(["B"], [], "B")).toBeNull();
  });
});
