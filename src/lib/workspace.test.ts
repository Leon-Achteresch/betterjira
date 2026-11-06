import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { appendBlocks, isEditableAdf, type AdfNode } from "./jira/adf";
import {
  ADF_COMMENT_TEMPLATES,
  EMPTY_WORKSPACE,
  RECENT_ISSUE_LIMIT,
  Workspaces,
  clearSubmittedMainDraft,
  clearSubmittedReplyDraft,
  mainDraftOf,
  migrateLegacyDrafts,
  migrateWorkspaces,
  rememberIssue,
  replyDraftOf,
  setIssueContext,
  setMainDraft,
  setReplyDraft,
  scopedFieldDraftKeys,
  togglePinnedIssue,
  workQueueItems,
  workspaceId,
} from "./workspace";

const line = (text: string): AdfNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...lines: string[]): AdfNode => ({ type: "doc", version: 1, content: lines.map(line) });

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
    workspace = setMainDraft(workspace, "A-0", doc("Antwort begonnen"));
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

describe("Kommentarentwürfe als ADF", () => {
  it("behält Hauptentwürfe anderer Tickets beim Löschen", () => {
    const workspace = setMainDraft(setMainDraft(EMPTY_WORKSPACE, "A-1", doc("Erster")), "A-2", doc("Zweiter"));
    expect(setMainDraft(workspace, "A-1", undefined).commentDrafts).toEqual({ "A-2": doc("Zweiter") });
    expect(mainDraftOf(workspace, "A-1")).toEqual(doc("Erster"));
  });

  it("speichert leere Dokumente nicht, Leerzeichen aber schon", () => {
    expect(setMainDraft(EMPTY_WORKSPACE, "A-1", { type: "doc", version: 1, content: [{ type: "paragraph" }] }).commentDrafts).toEqual({});
    expect(mainDraftOf(setMainDraft(EMPTY_WORKSPACE, "A-1", doc(" ")), "A-1")).toEqual(doc(" "));
  });

  it("löscht nach dem Senden nur den unveränderten Hauptentwurf", () => {
    const workspace = setMainDraft(EMPTY_WORKSPACE, "A-1", doc("Neu während Anfrage"));
    expect(clearSubmittedMainDraft(workspace, "A-1", doc("Alter Text"))).toBe(workspace);
    expect(clearSubmittedMainDraft(workspace, "A-1", doc("Neu während Anfrage")).commentDrafts).toEqual({});
  });

  it("speichert Antwortentwürfe je Ticket und Thread-Schlüssel", () => {
    let workspace = setReplyDraft(EMPTY_WORKSPACE, "A-1", "10", doc("Antwort 10"));
    workspace = setReplyDraft(workspace, "A-1", "20", doc("Antwort 20"));
    workspace = setReplyDraft(workspace, "B-1", "10", doc("Anderes Ticket"));
    expect(replyDraftOf(workspace, "A-1", "10")).toEqual(doc("Antwort 10"));
    expect(replyDraftOf(workspace, "B-1", "10")).toEqual(doc("Anderes Ticket"));
    workspace = setReplyDraft(workspace, "A-1", "10", undefined);
    expect(workspace.replyDrafts?.["A-1"]).toEqual({ "20": doc("Antwort 20") });
    workspace = setReplyDraft(workspace, "A-1", "20", undefined);
    expect(workspace.replyDrafts).toEqual({ "B-1": { "10": doc("Anderes Ticket") } });
  });

  it("löscht nach dem Senden nur die unveränderte Antwort", () => {
    const workspace = setReplyDraft(EMPTY_WORKSPACE, "A-1", "10", doc("Weiter getippt"));
    expect(clearSubmittedReplyDraft(workspace, "A-1", "10", doc("Gesendet"))).toBe(workspace);
    expect(replyDraftOf(clearSubmittedReplyDraft(workspace, "A-1", "10", doc("Weiter getippt")), "A-1", "10")).toBeUndefined();
  });

  it("übernimmt alte Textentwürfe als Absätze und entfernt sie aus drafts", () => {
    const legacy = { ...EMPTY_WORKSPACE, drafts: { "A-1": "*Stand*\n\n[~accountid:1] bitte prüfen", "A-2": "  " } };
    const migrated = migrateLegacyDrafts(legacy);
    expect(migrated.drafts).toEqual({});
    expect(mainDraftOf(migrated, "A-1")).toEqual({
      type: "doc",
      version: 1,
      content: [line("*Stand*"), { type: "paragraph" }, line("[~accountid:1] bitte prüfen")],
    });
    expect(mainDraftOf(migrated, "A-2")).toBeUndefined();
    expect(migrateLegacyDrafts(migrated)).toBe(migrated);
  });

  it("hängt einen alten Textentwurf an einen vorhandenen ADF-Entwurf an", () => {
    const both = { ...EMPTY_WORKSPACE, drafts: { "A-1": "Alt" }, commentDrafts: { "A-1": doc("Neu") } };
    expect(mainDraftOf(migrateLegacyDrafts(both), "A-1")).toEqual(doc("Neu", "Alt"));
  });

  it("migriert alle Konten beim Laden", () => {
    const workspaces = { a: { ...EMPTY_WORKSPACE, drafts: { "A-1": "Text" } }, b: EMPTY_WORKSPACE };
    const migrated = migrateWorkspaces(workspaces);
    expect(mainDraftOf(migrated["a"], "A-1")).toEqual(doc("Text"));
    expect(migrated["b"]).toBe(workspaces.b);
  });

  it("lädt Arbeitsbereiche aus der Version vor ADF-Entwürfen vollständig", () => {
    const legacy = { recent: [{ key: "A-1", summary: "Früher" }], pinned: [], drafts: { "A-1": "Text" }, newestFirst: true, contexts: {} };
    expect(Schema.is(Workspaces)({ account: legacy })).toBe(true);
    expect(workQueueItems(legacy, "drafts")[0]).toMatchObject({ key: "A-1", hasDraft: true });
  });

  it("bleibt für ältere App-Versionen lesbar", () => {
    const Remembered = Schema.Struct({ key: Schema.String, summary: Schema.String });
    const OldWorkspace = Schema.Struct({
      recent: Schema.Array(Remembered),
      pinned: Schema.Array(Remembered),
      drafts: Schema.Record(Schema.String, Schema.String),
      newestFirst: Schema.Boolean,
    });
    const current = setReplyDraft(setMainDraft(EMPTY_WORKSPACE, "A-1", doc("Neu")), "A-1", "10", doc("Antwort"));
    expect(Schema.is(OldWorkspace)(current)).toBe(true);
  });

  it("weist beschädigte ADF-Entwürfe zurück", () => {
    expect(Schema.is(Workspaces)({ test: { ...EMPTY_WORKSPACE, commentDrafts: { "A-1": "Text" } } })).toBe(false);
    expect(Schema.is(Workspaces)({ test: { ...EMPTY_WORKSPACE, replyDrafts: { "A-1": { "10": { type: "paragraph" } } } } })).toBe(false);
  });

  it("zählt Haupt- und Antwortentwürfe als angefangen und behält ihren Kontext", () => {
    let workspace = rememberIssue(EMPTY_WORKSPACE, { key: "A-0", summary: "Hauptentwurf" });
    workspace = rememberIssue(workspace, { key: "B-0", summary: "Antwortentwurf" });
    workspace = setMainDraft(workspace, "A-0", doc("Begonnen"));
    workspace = setReplyDraft(workspace, "B-0", "10", doc("Antwort begonnen"));
    for (let index = 1; index <= 65; index++) workspace = rememberIssue(workspace, { key: `A-${index}`, summary: `Aufgabe ${index}` });
    const pending = workQueueItems(workspace, "drafts");
    expect(pending.map((item) => item.key).sort()).toEqual(["A-0", "B-0"]);
    expect(pending.every((item) => item.hasDraft)).toBe(true);
    expect(workspace.contexts?.["A-0"]?.summary).toBe("Hauptentwurf");
    expect(workspace.contexts?.["B-0"]?.summary).toBe("Antwortentwurf");
  });

  it("fügt Vorlagen als fette Überschrift mit Aufzählung am Ende ein", () => {
    const [status] = ADF_COMMENT_TEMPLATES;
    const result = appendBlocks(doc("Meine Notiz"), status.blocks);
    expect(result.content?.[0]).toEqual(line("Meine Notiz"));
    expect(result.content?.[1]).toEqual({ type: "paragraph", content: [{ type: "text", text: "Stand", marks: [{ type: "strong" }] }] });
    expect(result.content?.[2]?.type).toBe("bulletList");
    expect(ADF_COMMENT_TEMPLATES.map((template) => template.label)).toEqual(["Statusupdate", "Rückfrage", "Übergabe"]);
    expect(ADF_COMMENT_TEMPLATES.every((template) => isEditableAdf(appendBlocks(undefined, template.blocks)))).toBe(true);
  });
});
