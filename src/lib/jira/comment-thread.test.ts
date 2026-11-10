import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import type { AdfNode } from "./adf";
import {
  RawComment,
  buildThreads,
  replyPayload,
  replyPrefill,
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
