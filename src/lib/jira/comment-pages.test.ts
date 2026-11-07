import { describe, expect, it } from "vitest";
import {
  commentPageKeys,
  commentProgressLabel,
  initialCommentPosition,
  nextCommentPosition,
  summarizeCommentThread,
  type CommentPage,
} from "./comment-pages";
import { jiraKeys } from "./queries";

const comment = (id: string) => ({ id, body: null, created: `2026-11-0${id.length}T10:00:00Z` });
const page = (requestedAt: number, ids: string[], meta: Partial<CommentPage> = {}): CommentPage => ({
  requestedAt,
  comments: ids.map(comment),
  ...meta,
});

describe("nextCommentPosition", () => {
  it("rechnet mit bestätigtem startAt und tatsächlicher Anzahl statt mit maxResults", () => {
    expect(nextCommentPosition(page(2, ["c3", "c4"], { startAt: 2, maxResults: 50, total: 9 }))).toBe(4);
    expect(nextCommentPosition(page(2, ["c2", "c3", "c4"], { startAt: 1, total: 9 }))).toBe(4);
  });

  it("nimmt den angefragten Start, wenn Jira startAt nicht bestätigt", () => {
    expect(nextCommentPosition(page(6, ["c7"], { total: 9 }))).toBe(7);
  });

  it("beendet bei leerer Seite, erreichter Gesamtzahl oder fehlendem Fortschritt", () => {
    expect(nextCommentPosition(page(2, [], { total: 9 }))).toBeUndefined();
    expect(nextCommentPosition(page(7, ["c8", "c9"], { startAt: 7, total: 9 }))).toBeUndefined();
    expect(nextCommentPosition(page(4, ["c1", "c2"], { startAt: 0, total: 9 }))).toBeUndefined();
  });

  it("verlässt sich ohne Gesamtzahl auf eine bestätigte Seitengröße", () => {
    expect(nextCommentPosition(page(0, ["c1", "c2"], { maxResults: 2 }))).toBe(2);
    expect(nextCommentPosition(page(0, ["c1"], { maxResults: 2 }))).toBeUndefined();
    expect(nextCommentPosition(page(0, ["c1"]))).toBe(1);
  });

  it("ignoriert ungültige Metadaten", () => {
    expect(nextCommentPosition(page(2, ["c3"], { startAt: -5, total: 1.5 }))).toBe(3);
  });
});

describe("initialCommentPosition", () => {
  it("setzt hinter dem Detailfenster fort oder beginnt bei 0, wenn es nicht am Anfang liegt", () => {
    expect(initialCommentPosition(page(0, ["c1", "c2"], { total: 7 }))).toBe(2);
    expect(initialCommentPosition(page(0, ["c6", "c7"], { startAt: 5, total: 7 }))).toBe(0);
    expect(initialCommentPosition(page(0, ["c1", "c2"], { total: 2 }))).toBeUndefined();
    expect(initialCommentPosition(page(0, []))).toBeUndefined();
  });
});

describe("summarizeCommentThread", () => {
  it("dedupliziert über Detail und mehrere, auch kürzere Seiten", () => {
    const detail = page(0, ["c1", "c2"], { startAt: 0, maxResults: 2, total: 7 });
    const pages = [
      page(2, ["c2", "c3", "c4"], { startAt: 1, maxResults: 3, total: 7 }),
      page(4, ["c4", "c5"], { startAt: 4, maxResults: 2, total: 7 }),
      page(6, ["c5", "c6", "c7"], { startAt: 4, maxResults: 50, total: 7 }),
    ];
    const thread = summarizeCommentThread(detail, pages.slice(0, 2));
    expect(thread.comments.map(({ id }) => id)).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    expect(thread).toMatchObject({ loaded: 5, total: 7, next: 6, incomplete: false });
    expect(summarizeCommentThread(detail, pages)).toMatchObject({ loaded: 7, next: undefined, incomplete: false });
  });

  it("meldet eine Lücke, wenn Jira vor der Gesamtzahl aufhört", () => {
    const thread = summarizeCommentThread(page(0, ["c1", "c2"], { total: 7 }), [page(2, [], { startAt: 2, total: 7 })]);
    expect(thread).toMatchObject({ loaded: 2, total: 7, next: undefined, incomplete: true });
    expect(commentProgressLabel(thread)).toBe("2 von 7 Kommentaren geladen · Jira liefert keine weiteren");
  });

  it("nimmt die jüngste Gesamtzahl, aber nie weniger als geladen", () => {
    const detail = page(0, ["c1", "c2"], { total: 3 });
    expect(summarizeCommentThread(detail, [page(2, ["c3", "c4"], { total: 4 })]).total).toBe(4);
    expect(summarizeCommentThread(detail, [page(2, ["c3", "c4"], { total: 2 })]).total).toBe(4);
    expect(summarizeCommentThread(page(0, ["c1"]), []).total).toBeUndefined();
  });
});

describe("commentProgressLabel", () => {
  it("zeigt geladen/gesamt, unbekannte Gesamtzahl und Vollständigkeit ehrlich", () => {
    expect(commentProgressLabel({ comments: [], loaded: 2, total: 7, next: 2, incomplete: false })).toBe(
      "2 von 7 Kommentaren geladen",
    );
    expect(commentProgressLabel({ comments: [], loaded: 3, next: 3, incomplete: false })).toBe(
      "3 Kommentare geladen · Gesamtzahl unbekannt",
    );
    expect(commentProgressLabel({ comments: [], loaded: 7, total: 7, incomplete: false })).toBe("Alle 7 Kommentare geladen");
  });
});

describe("commentPageKeys", () => {
  it("liegt unter dem Ticket-Key und trennt Instanz und Konto", () => {
    const key = commentPageKeys.issue("cloud-a", "user-a", "DEMO-1");
    expect(key.slice(0, jiraKeys.issue("DEMO-1").length)).toEqual([...jiraKeys.issue("DEMO-1")]);
    expect(key).not.toEqual(commentPageKeys.issue("cloud-b", "user-a", "DEMO-1"));
    expect(key).not.toEqual(commentPageKeys.issue("cloud-a", "user-b", "DEMO-1"));
    expect(key).not.toEqual(commentPageKeys.issue("cloud-a", "user-a", "DEMO-2"));
  });
});
