import { describe, expect, it } from "vitest";
import { Effect, Schema } from "effect";
import type { AdfNode } from "./adf";
import {
  RawComment,
  buildThreads,
  collectCommentPages,
  commentCount,
  commentJumpState,
  commentLink,
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
const raw = (id: string) => ({ id, body: null, created: "2026-11-01T10:00:00Z" });
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

  it("lädt Seiten zu je 100, bis total erreicht ist", () => {
    const all = Array.from({ length: 150 }, (_, index) => raw(String(index)));
    const calls: number[] = [];
    const result = Effect.runSync(
      collectCommentPages((startAt) => {
        calls.push(startAt);
        return Effect.succeed({ startAt, maxResults: 100, total: all.length, comments: all.slice(startAt, startAt + 100) });
      }),
    );
    expect(result).toHaveLength(150);
    expect(calls).toEqual([0, 100]);
  });

  it("setzt bei kürzeren Seiten als angefragt richtig fort", () => {
    const all = Array.from({ length: 5 }, (_, index) => raw(String(index)));
    const calls: number[] = [];
    const result = Effect.runSync(
      collectCommentPages((startAt) => {
        calls.push(startAt);
        return Effect.succeed({ startAt, maxResults: 2, total: all.length, comments: all.slice(startAt, startAt + 2) });
      }),
    );
    expect(result.map((entry) => entry.id)).toEqual(["0", "1", "2", "3", "4"]);
    expect(calls).toEqual([0, 2, 4]);
  });

  it("bricht bei leerer Seite ab, auch wenn total mehr verspricht", () => {
    const result = Effect.runSync(
      collectCommentPages((startAt) =>
        Effect.succeed({ startAt, maxResults: 100, total: 300, comments: startAt === 0 ? [raw("1")] : [] }),
      ),
    );
    expect(result).toHaveLength(1);
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

  it("verliert keinen Kommentar, wenn eine Antwort auf eine Antwort zeigt", () => {
    const threads = buildThreads([comment("1", "1"), comment("2", "2", "1"), comment("3", "3", "2")], false);
    expect(threads).toHaveLength(1);
    expect(threads[0]?.replies.map((reply) => reply.id)).toEqual(["2", "3"]);
  });

  it("nimmt als Thread-Schlüssel parentId, sonst die eigene ID", () => {
    expect(threadKey(comment("3", "3", "1"))).toBe("1");
    expect(threadKey(comment("1", "1"))).toBe("1");
  });

  it("zählt alle Kommentare einschließlich Antworten", () => {
    expect(commentCount([comment("1", "1"), comment("2", "2", "1"), comment("3", "3")], { total: 20, comments: [] })).toBe(3);
    expect(commentCount(undefined, { total: 25, comments: [] })).toBe(25);
    expect(commentCount(undefined, { comments: [1, 2] })).toBe(2);
    expect(commentCount(undefined, undefined)).toBe(0);
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

  it("baut den Kommentar-Link wie Jira", () => {
    expect(commentLink("https://example.atlassian.net", "DEMO-1", "10002")).toBe(
      "https://example.atlassian.net/browse/DEMO-1?focusedCommentId=10002",
    );
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
    expect(commentJumpState(undefined, "2", "none")).toBe("wait");
    expect(commentJumpState(list, undefined, "none")).toBe("idle");
  });

  it("findet Thread-Anfänge und Antworten", () => {
    expect(commentJumpState(list, "1", "none")).toBe("found");
    expect(commentJumpState(list, "2", "failed")).toBe("found");
  });

  it("lädt einmal neu, bevor es einen Kommentar als fehlend meldet", () => {
    expect(commentJumpState(list, "9", "none")).toBe("refetch");
    expect(commentJumpState(list, "9", "running")).toBe("wait");
    expect(commentJumpState(list, "9", "refreshed")).toBe("missing");
  });

  it("meldet nichts als fehlend, wenn das Nachladen einer zwischengespeicherten Liste scheitert", () => {
    expect(commentJumpState(list, "9", "failed")).toBe("wait");
  });

  it("zählt nur neue Daten als Neuladen, einen Fehler als gescheitert", () => {
    expect(refetchProgress(undefined, 500, 500)).toBe("none");
    expect(refetchProgress(100, 50, 0)).toBe("running");
    expect(refetchProgress(100, 150, 0)).toBe("refreshed");
    expect(refetchProgress(100, 50, 150)).toBe("failed");
    expect(refetchProgress(100, 160, 150)).toBe("refreshed");
  });
});
