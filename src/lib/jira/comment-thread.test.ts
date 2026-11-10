import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import type { AdfNode } from "./adf";
import {
  RawComment,
  buildThreads,
  commentJumpState,
  deleteReplyHint,
  editPayload,
  editedNote,
  refetchProgress,
  replyPayload,
  replyPrefill,
  repliesKeptOnDelete,
  threadKey,
  toIssueComment,
  type IssueComment,
} from "./comment-thread";

const avatar = { "48x48": "a.png" };
const comment = (id: string, day: string, parentId?: string): IssueComment => ({
  id,
  created: `2026-11-0${day}T10:00:00Z`,
  body: null,
  ...(parentId && { parentId }),
});
const doc: AdfNode = { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "Hallo" }] }] };

describe("Kommentarliste", () => {
  it("führt parentId als Zeichenkette, ob Jira Zahl oder Text liefert", () => {
    expect(toIssueComment({ id: "2", parentId: 1, body: null, created: "x" }).parentId).toBe("1");
    expect(toIssueComment({ id: "3", parentId: "1", body: null, created: "x" }).parentId).toBe("1");
    expect(toIssueComment({ id: "1", body: null, created: "x" })).not.toHaveProperty("parentId");
    expect(toIssueComment({ id: "4", parentId: null, body: null, created: "x" })).not.toHaveProperty("parentId");
  });

  it("übernimmt accountId, accountType und active des Autors", () => {
    const decoded = Schema.decodeUnknownSync(RawComment)({
      id: "2",
      parentId: 56518,
      author: { accountId: "a", accountType: "atlassian", active: true, displayName: "Anna", avatarUrls: avatar, emailAddress: "a@example.com" },
      body: {},
      created: "2026-11-01T10:00:00Z",
    });
    expect(toIssueComment(decoded)).toMatchObject({
      parentId: "56518",
      author: { accountId: "a", accountType: "atlassian", active: true, displayName: "Anna" },
    });
  });
});

describe("Threads", () => {
  it("hängt Antworten chronologisch unter ihren Thread-Anfang, in beiden Sortierungen", () => {
    const comments = [comment("1", "1"), comment("2", "2"), comment("4", "4", "1"), comment("3", "3", "1")];
    const oldest = buildThreads(comments, false);
    expect(oldest.map((thread) => thread.root.id)).toEqual(["1", "2"]);
    expect(oldest[0]?.replies.map((reply) => reply.id)).toEqual(["3", "4"]);
    const newest = buildThreads(comments, true);
    expect(newest.map((thread) => thread.root.id)).toEqual(["2", "1"]);
    expect(newest[1]?.replies.map((reply) => reply.id)).toEqual(["3", "4"]);
  });

  it("zeigt eine Antwort ohne vorhandenen Thread-Anfang als eigenen Thread", () => {
    const threads = buildThreads([comment("1", "1"), comment("5", "2", "99")], false);
    expect(threads.map((thread) => thread.root.id)).toEqual(["1", "5"]);
    expect(threads.flatMap((thread) => thread.replies)).toEqual([]);
  });

  it("fasst Antworten ohne geladene Wurzel zu einem Thread zusammen und hängt sie nach dem Nachladen unter die Wurzel", () => {
    const orphans = buildThreads([comment("5", "2", "1"), comment("6", "3", "1"), comment("7", "4")], false);
    expect(orphans.map((thread) => [thread.root.id, thread.replies.map((reply) => reply.id)])).toEqual([
      ["5", ["6"]],
      ["7", []],
    ]);
    expect(threadKey(orphans[0]!.root)).toBe("1");
    const loaded = buildThreads([comment("1", "1"), comment("5", "2", "1"), comment("6", "3", "1"), comment("7", "4")], false);
    expect(loaded.map((thread) => [thread.root.id, thread.replies.map((reply) => reply.id)])).toEqual([
      ["1", ["5", "6"]],
      ["7", []],
    ]);
  });

  it("verliert keinen Kommentar, wenn eine Antwort auf eine Antwort zeigt", () => {
    const threads = buildThreads([comment("1", "1"), comment("2", "2", "1"), comment("3", "3", "2")], false);
    expect(threads).toHaveLength(1);
    expect(threads[0]?.replies.map((reply) => reply.id)).toEqual(["2", "3"]);
  });

  it("nimmt als Thread-Schlüssel parentId, sonst die eigene ID", () => {
    expect(threadKey(comment("3", "3", "1"))).toBe("1");
    expect(threadKey(comment("1", "1"))).toBe("1");
  });
});

describe("Antworten", () => {
  it("sendet parentId als Zahl, wenn der Thread-Schlüssel nur Ziffern hat", () => {
    expect(replyPayload(doc, "10002")).toEqual({ body: doc, parentId: 10002 });
    expect(replyPayload(doc, "abc")).toEqual({ body: doc, parentId: "abc" });
  });

  it("belegt mit dem Autor vor, außer bei eigenen Kommentaren oder ohne accountId", () => {
    const ben = { accountId: "b", displayName: "Ben", avatarUrls: avatar };
    expect(replyPrefill(ben, "me")).toEqual({
      type: "doc",
      version: 1,
      content: [{ type: "paragraph", content: [{ type: "mention", attrs: { id: "b", text: "@Ben" } }, { type: "text", text: " " }] }],
    });
    expect(replyPrefill(ben, "b")).toBeUndefined();
    expect(replyPrefill({ displayName: "Anonym", avatarUrls: avatar }, "me")).toBeUndefined();
    expect(replyPrefill(undefined, "me")).toBeUndefined();
  });

  it("belegt App-Konten und deaktivierte Autoren nicht vor", () => {
    expect(replyPrefill({ accountId: "app", accountType: "app", displayName: "Automation", avatarUrls: avatar }, "me")).toBeUndefined();
    expect(replyPrefill({ accountId: "old", active: false, displayName: "Ehemalig", avatarUrls: avatar }, "me")).toBeUndefined();
  });

  it("fasst verwaiste Antworten mit derselben parentId zu einem Thread zusammen", () => {
    const threads = buildThreads([comment("1", "1"), comment("5", "3", "99"), comment("6", "4", "99"), comment("7", "5", "5")], false);
    expect(threads.map((thread) => [thread.root.id, thread.replies.map((reply) => reply.id)])).toEqual([
      ["1", []],
      ["5", ["6", "7"]],
    ]);
    expect(new Set(threads.map((thread) => threadKey(thread.root))).size).toBe(threads.length);
  });
});

describe("Bearbeiten und Löschen", () => {
  const lea = { accountId: "lea", displayName: "Lea", avatarUrls: avatar };

  it("übernimmt updated, updateAuthor und visibility, sofern geliefert", () => {
    const decoded = Schema.decodeUnknownSync(RawComment)({
      id: "7",
      body: {},
      created: "2026-11-04T13:00:00Z",
      updated: "2026-11-05T08:30:00Z",
      updateAuthor: { ...lea, accountType: "atlassian" },
      visibility: { type: "role", value: "Developers", identifier: "Developers" },
    });
    expect(toIssueComment(decoded)).toMatchObject({
      updated: "2026-11-05T08:30:00Z",
      updateAuthor: { accountId: "lea", displayName: "Lea" },
      visibility: { type: "role", value: "Developers", identifier: "Developers" },
    });
    const plain = toIssueComment(Schema.decodeUnknownSync(RawComment)({ id: "8", body: {}, created: "x", updateAuthor: null, visibility: null }));
    expect(plain).not.toHaveProperty("updateAuthor");
    expect(plain).not.toHaveProperty("visibility");
  });

  it("markiert nur Kommentare als bearbeitet, deren updated nach created liegt", () => {
    const base = { ...comment("1", "4"), updated: "2026-11-05T08:30:00Z" };
    const when = new Date("2026-11-05T08:30:00Z").toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
    expect(editedNote({ ...base, updateAuthor: lea })).toBe(`Bearbeitet am ${when} von Lea`);
    expect(editedNote(base)).toBe(`Bearbeitet am ${when}`);
    expect(editedNote({ ...base, updated: base.created })).toBeUndefined();
    expect(editedNote(comment("2", "4"))).toBeUndefined();
  });

  it("sendet beim Speichern visibility nur für Thread-Anfänge mit", () => {
    const visibility = { type: "role", value: "Developers" };
    expect(editPayload(doc, { ...comment("1", "1"), visibility })).toEqual({ body: doc, visibility });
    expect(editPayload(doc, { ...comment("2", "2", "1"), visibility })).toEqual({ body: doc });
    expect(editPayload(doc, comment("3", "3"))).toEqual({ body: doc });
  });

  it("nennt beim Löschen eines Thread-Anfangs die Antworten, die stehen bleiben", () => {
    const [thread] = buildThreads([comment("1", "1"), comment("2", "2", "1"), comment("3", "3", "1")], false);
    expect(repliesKeptOnDelete(thread!, thread!.root)).toBe(2);
    expect(repliesKeptOnDelete(thread!, thread!.replies[0]!)).toBe(0);
    expect(deleteReplyHint(2)).toBe("Die 2 Antworten bleiben erhalten und stehen danach als eigener Thread.");
    expect(deleteReplyHint(1)).toBe("Die Antwort bleibt erhalten und steht danach als eigener Thread.");
    expect(deleteReplyHint(0)).toBeUndefined();
  });

  it("zählt bei einem verwaisten Thread-Anfang keine Antworten", () => {
    const [, orphan] = buildThreads([comment("1", "1"), comment("5", "3", "99"), comment("6", "4", "99")], false);
    expect(repliesKeptOnDelete(orphan!, orphan!.root)).toBe(0);
  });
});

describe("Sprung zum Kommentar", () => {
  const list = [comment("1", "1"), comment("2", "2", "1")];

  it("wartet ohne Liste und tut ohne Ziel nichts", () => {
    expect(commentJumpState(undefined, "2", "none", false)).toBe("wait");
    expect(commentJumpState(list, undefined, "none", true)).toBe("idle");
  });

  it("findet Thread-Anfänge und Antworten", () => {
    expect(commentJumpState(list, "1", "none", true)).toBe("found");
    expect(commentJumpState(list, "2", "failed", false)).toBe("found");
  });

  it("lädt weitere Seiten, solange es welche gibt, statt den Kommentar als fehlend zu melden", () => {
    expect(commentJumpState(list, "9", "none", true)).toBe("more");
    expect(commentJumpState(list, "9", "refreshed", true)).toBe("more");
    expect(commentJumpState(list, "9", "failed", true)).toBe("more");
    expect(commentJumpState(list, "9", "running", true)).toBe("wait");
  });

  it("lädt einmal neu, bevor es einen Kommentar als fehlend meldet", () => {
    expect(commentJumpState(list, "9", "none", false)).toBe("refetch");
    expect(commentJumpState(list, "9", "running", false)).toBe("wait");
    expect(commentJumpState(list, "9", "refreshed", false)).toBe("missing");
  });

  it("meldet nichts als fehlend, wenn das Nachladen einer zwischengespeicherten Liste scheitert", () => {
    expect(commentJumpState(list, "9", "failed", false)).toBe("wait");
  });

  it("zählt nur neue Daten als Neuladen, einen Fehler als gescheitert", () => {
    expect(refetchProgress(undefined, 500, 500)).toBe("none");
    expect(refetchProgress(100, 50, 0)).toBe("running");
    expect(refetchProgress(100, 150, 0)).toBe("refreshed");
    expect(refetchProgress(100, 50, 150)).toBe("failed");
    expect(refetchProgress(100, 160, 150)).toBe("refreshed");
  });
});
