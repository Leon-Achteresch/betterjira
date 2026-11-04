import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import {
  EMPTY_WORKSPACE,
  RECENT_ISSUE_LIMIT,
  Workspaces,
  appendTemplate,
  clearSubmittedDraft,
  rememberIssue,
  setCommentDraft,
  togglePinnedIssue,
  workspaceId,
  setIssueContext,
  scopedFieldDraftKeys,
  workQueueItems,
} from "./workspace";

describe("lokaler Arbeitsbereich", () => {
  it("trennt Instanzen und Konten ohne mehrdeutige Schlüssel", () => {
    expect(workspaceId("a", "b:c")).not.toBe(workspaceId("a:b", "c"));
    expect(workspaceId("a", "user1")).not.toBe(workspaceId("a", "user2"));
  });

  it("merkt die letzten Vorgänge ohne Duplikate und aktualisiert angeheftete Titel", () => {
    const issue = { key: "A-1", summary: "Alt" };
    const workspace = rememberIssue(togglePinnedIssue(EMPTY_WORKSPACE, issue), issue);
    const updated = rememberIssue(workspace, { ...issue, summary: "Neu" });
    expect(updated.recent).toEqual([{ ...issue, summary: "Neu" }]);
    expect(updated.pinned).toEqual(updated.recent);
    expect(workspace.pinned[0]?.summary).toBe("Alt");
  });

  it("begrenzt den Verlauf und stellt zuletzt besuchte Tickets nach vorne", () => {
    let workspace = EMPTY_WORKSPACE;
    for (let index = 0; index < RECENT_ISSUE_LIMIT + 8; index++)
      workspace = rememberIssue(workspace, {
        key: `A-${index}`,
        summary: "Ticket",
      });
    workspace = rememberIssue(workspace, {
      key: "A-10",
      summary: "Wieder geöffnet",
    });
    expect(workspace.recent).toHaveLength(RECENT_ISSUE_LIMIT);
    expect(workspace.recent[0]?.key).toBe("A-10");
    expect(workspace.recent.some(({ key }) => key === "A-0")).toBe(false);
  });

  it("heftet an und entfernt ohne den Verlauf zu löschen", () => {
    const issue = { key: "A-1", summary: "Ticket" };
    const workspace = rememberIssue(EMPTY_WORKSPACE, issue);
    expect(togglePinnedIssue(togglePinnedIssue(workspace, issue), issue)).toEqual(workspace);
  });

  it("behält Entwürfe anderer Vorgänge beim Löschen", () => {
    const workspace = setCommentDraft(setCommentDraft(EMPTY_WORKSPACE, "A-1", "Erster"), "A-2", "Zweiter");
    expect(setCommentDraft(workspace, "A-1", "").drafts).toEqual({
      "A-2": "Zweiter",
    });
    expect(workspace.drafts["A-1"]).toBe("Erster");
  });

  it("löscht nach dem Absenden nur den tatsächlich gesendeten Entwurf", () => {
    const workspace = setCommentDraft(EMPTY_WORKSPACE, "A-1", "Neu während Anfrage");
    expect(clearSubmittedDraft(workspace, "A-1", "Alter Text")).toBe(workspace);
    expect(clearSubmittedDraft(workspace, "A-1", "Neu während Anfrage").drafts).toEqual({});
  });

  it("ergänzt Vorlagen ohne vorhandenen Text zu überschreiben", () => {
    expect(appendTemplate("Meine Notiz", "Vorlage")).toBe("Meine Notiz\n\nVorlage");
    expect(appendTemplate("  ", "Vorlage")).toBe("Vorlage");
  });

  it("weist beschädigte gespeicherte Daten zurück", () => {
    expect(Schema.is(Workspaces)({ test: EMPTY_WORKSPACE })).toBe(true);
    expect(
      Schema.is(Workspaces)({
        test: { ...EMPTY_WORKSPACE, drafts: { "A-1": null } },
      }),
    ).toBe(false);
    expect(
      Schema.is(Workspaces)({
        test: { ...EMPTY_WORKSPACE, recent: [{ key: "A-1" }] },
      }),
    ).toBe(false);
  });
});

describe("Wiederaufnahme im Arbeitsalltag", () => {
  it("begrenzt reine Lesekontexte und erhält angefangene oder bewusst gemerkte Arbeit", () => {
    let workspace = rememberIssue(EMPTY_WORKSPACE, { key: "A-0", summary: "Feldentwurf" });
    workspace = rememberIssue(workspace, { key: "A-1", summary: "Notiz" });
    workspace = setIssueContext(workspace, "A-1", { note: "Absichtlich behalten" });
    for (let index = 2; index < 90; index++)
      workspace = rememberIssue(workspace, { key: `A-${index}`, summary: "Ticket" }, {}, ["A-0"]);
    expect(Object.keys(workspace.contexts ?? {})).toHaveLength(52);
    expect(workspace.contexts?.["A-0"]?.summary).toBe("Feldentwurf");
    expect(workspace.contexts?.["A-1"]?.note).toBe("Absichtlich behalten");
    expect(workspace.contexts?.["A-2"]).toBeUndefined();
  });
  it("kann alte gespeicherte Arbeitsbereiche ohne Lesekontexte weiterverwenden", () => {
    const legacy = { recent: [{ key: "A-1", summary: "Früher" }], pinned: [], drafts: {}, newestFirst: false };
    expect(Schema.is(Workspaces)({ account: legacy })).toBe(true);
    expect(workQueueItems(legacy)[0]?.summary).toBe("Früher");
    expect(setIssueContext(legacy, "A-1", { note: "Später prüfen" }).contexts?.["A-1"]?.note).toBe("Später prüfen");
  });

  it("behält Entwürfe und Notizen unabhängig von fünfzig zuletzt geöffneten Tickets erreichbar", () => {
    let workspace = rememberIssue(EMPTY_WORKSPACE, { key: "A-0", summary: "Nicht vergessen" });
    workspace = setCommentDraft(workspace, "A-0", "Antwort begonnen");
    workspace = setIssueContext(workspace, "A-0", { note: "Morgen mit Lea besprechen", scrollTop: 720 });
    for (let index = 1; index <= 65; index++)
      workspace = rememberIssue(workspace, { key: `A-${index}`, summary: `Aufgabe ${index}` });
    expect(workspace.recent).toHaveLength(50);
    const pending = workQueueItems(workspace, "drafts");
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      key: "A-0",
      summary: "Nicht vergessen",
      note: "Morgen mit Lea besprechen",
      hasReadingPosition: true,
      hasDraft: true,
    });
  });

  it("überschreibt beim Merken weder Notiz noch Lesestelle", () => {
    let workspace = setIssueContext(EMPTY_WORKSPACE, "A-1", { note: "Nächster Schritt", scrollTop: 480 });
    workspace = rememberIssue(
      workspace,
      { key: "A-1", summary: "Neuer Titel" },
      { visitedAt: 123, statusName: "Erledigt", statusColor: "green" },
    );
    expect(workspace.contexts?.["A-1"]).toMatchObject({
      note: "Nächster Schritt",
      scrollTop: 480,
      visitedAt: 123,
      summary: "Neuer Titel",
    });
    expect(workQueueItems(workspace)[0]?.status?.name).toBe("Erledigt");
  });

  it("durchsucht auch private Notizen ohne fremde Konten einzubeziehen", () => {
    const workspace = setIssueContext(EMPTY_WORKSPACE, "A-1", { note: "Mit LEA testen" });
    expect(workQueueItems(workspace, "drafts", "lea").map((item) => item.key)).toEqual(["A-1"]);
    expect(workQueueItems(workspace, "drafts", "Markus")).toEqual([]);
  });

  it("findet Feldentwürfe auch außerhalb des Ticketverlaufs und isoliert deren Namespace", () => {
    const ids = [
      JSON.stringify(["cloud", "me", "A-1", "summary"]),
      JSON.stringify(["cloud", "me", "A-1", "description"]),
      JSON.stringify(["cloud", "other", "B-1", "summary"]),
      "kein json",
    ];
    const keys = scopedFieldDraftKeys(ids, workspaceId("cloud", "me"));
    expect(keys).toEqual(["A-1"]);
    expect(scopedFieldDraftKeys(ids, undefined)).toEqual([]);
    expect(workQueueItems(EMPTY_WORKSPACE, "drafts", "", keys)[0]).toMatchObject({ key: "A-1", hasFieldDraft: true });
  });
});
