import { describe, expect, it } from "vitest";
import {
  commentPageKeys,
  commentProgressLabel,
  embeddedCommentsChanged,
  initialCommentPosition,
  nextCommentPosition,
  pagesOutdatedBy,
  summarizeCommentPages,
  withEditedPostedComment,
  withoutPostedComment,
  withPostedComment,
  type CommentPage,
} from "./comment-pages";
import { jiraKeys } from "./keys";

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

  it("lädt ohne Gesamtzahl auch nach kürzeren Seiten bis zu einer leeren Seite weiter", () => {
    expect(nextCommentPosition(page(0, ["c1", "c2"], { maxResults: 2 }))).toBe(2);
    expect(nextCommentPosition(page(0, ["c1"], { maxResults: 2 }))).toBe(1);
    expect(nextCommentPosition(page(0, ["c1"]))).toBe(1);
    expect(nextCommentPosition(page(1, [], { maxResults: 2 }))).toBeUndefined();
    expect(nextCommentPosition(page(2, ["c3", "c4"], { total: 2 }))).toBe(4);
  });

  it("ignoriert ungültige Metadaten", () => {
    expect(nextCommentPosition(page(2, ["c3"], { startAt: -5, total: 1.5 }))).toBe(3);
    expect(nextCommentPosition(page(2, ["c3"], { startAt: Number.MAX_SAFE_INTEGER + 1, total: Infinity }))).toBe(3);
    expect(nextCommentPosition(page(Number.MAX_SAFE_INTEGER, ["c3"]))).toBeUndefined();
  });
});

describe("initialCommentPosition", () => {
  it("setzt hinter dem Detailfenster fort oder beginnt bei 0, wenn es nicht am Anfang liegt", () => {
    expect(initialCommentPosition(page(0, ["c1", "c2"], { total: 7 }))).toBe(2);
    expect(initialCommentPosition(page(0, ["c6", "c7"], { startAt: 5, total: 7 }))).toBe(0);
    expect(initialCommentPosition(page(0, ["c1", "c2"], { total: 2 }))).toBeUndefined();
    expect(initialCommentPosition(page(0, []))).toBe(0);
    expect(initialCommentPosition(page(0, [], { total: 0 }))).toBeUndefined();
  });
});

describe("summarizeCommentPages", () => {
  it("dedupliziert über Detail und mehrere, auch kürzere Seiten", () => {
    const detail = page(0, ["c1", "c2"], { startAt: 0, maxResults: 2, total: 7 });
    const pages = [
      page(2, ["c2", "c3", "c4"], { startAt: 1, maxResults: 3, total: 7 }),
      page(4, ["c4", "c5"], { startAt: 4, maxResults: 2, total: 7 }),
      page(6, ["c5", "c6", "c7"], { startAt: 4, maxResults: 50, total: 7 }),
    ];
    const thread = summarizeCommentPages(detail, pages.slice(0, 2));
    expect(thread.comments.map(({ id }) => id)).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    expect(thread).toMatchObject({ loaded: 5, total: 7, next: 6, incomplete: false });
    expect(summarizeCommentPages(detail, pages)).toMatchObject({ loaded: 7, next: undefined, incomplete: false });
  });

  it("meldet eine Lücke, wenn Jira vor der Gesamtzahl aufhört", () => {
    const thread = summarizeCommentPages(page(0, ["c1", "c2"], { total: 7 }), [page(2, [], { startAt: 2, total: 7 })]);
    expect(thread).toMatchObject({ loaded: 2, total: 7, next: undefined, incomplete: true });
    expect(commentProgressLabel(thread)).toBe("2 von 7 Kommentaren geladen · Jira liefert keine weiteren");
  });

  it("setzt nach einer inzwischen gewachsenen Gesamtzahl hinter zuvor vollständigen Cache-Seiten fort", () => {
    const cached = page(2, ["c3", "c4", "c5", "c6", "c7"], { startAt: 2, total: 7 });
    const current = page(0, ["c1", "c2"], { startAt: 0, total: 8 });
    expect(summarizeCommentPages(current, [cached])).toMatchObject({ loaded: 7, total: 8, next: 7, incomplete: false });
    expect(summarizeCommentPages(current, [cached, page(7, ["c8"], { startAt: 7, total: 8 })]))
      .toMatchObject({ loaded: 8, total: 8, next: undefined, incomplete: false });
  });

  it("bewahrt die höchste bekannte Gesamtzahl, aber nie weniger als geladen", () => {
    const detail = page(0, ["c1", "c2"], { total: 3 });
    expect(summarizeCommentPages(detail, [page(2, ["c3"], { total: 9 })]).total).toBe(9);
    expect(summarizeCommentPages(detail, [page(2, ["c3", "c4"], { total: 4 })]).total).toBe(4);
    expect(summarizeCommentPages(detail, [page(2, ["c3", "c4"], { total: 2 })]).total).toBe(4);
    expect(summarizeCommentPages(page(0, ["c1", "c2"], { total: 7 }), [page(2, ["c3", "c4"], { total: 2 })]))
      .toMatchObject({ loaded: 4, total: 7, next: 4 });
    expect(summarizeCommentPages(page(0, ["c1"]), []).total).toBeUndefined();
  });
});

describe("eigene neue Kommentare", () => {
  it("zeigt einen gesendeten Kommentar sofort, auch wenn spätere Seiten fehlen, ohne das Weiterladen zu verschieben", () => {
    const detail = page(0, ["c1", "c2"], { total: 7 });
    const loaded = [page(0, ["c1", "c2"], { startAt: 0, total: 7 })];
    const posted = withPostedComment(undefined, { id: "c8", parentId: "c1", body: null, created: "2026-11-09T10:00:00Z" });
    const thread = summarizeCommentPages(detail, loaded, posted);
    expect(thread.comments.map(({ id }) => id)).toEqual(["c1", "c2", "c8"]);
    expect(thread).toMatchObject({ loaded: 3, total: 7, next: 2 });
  });

  it("nimmt den Eintrag der Seite, sobald Jira den Kommentar mitliefert", () => {
    const fromPage = { ...comment("c3"), body: "von Jira" };
    const posted = withPostedComment(withPostedComment(undefined, { ...comment("c3"), body: "alt" }), { ...comment("c3"), body: "gesendet" });
    expect(posted).toHaveLength(1);
    const thread = summarizeCommentPages(page(0, []), [{ requestedAt: 0, comments: [fromPage], total: 1 }], posted);
    expect(thread.comments).toEqual([fromPage]);
    expect(thread.loaded).toBe(1);
  });

  it("entfernt einen gelöschten eigenen Kommentar, damit er nach dem Neuladen nicht wieder erscheint", () => {
    const posted = withPostedComment(withPostedComment(undefined, comment("c8")), comment("c9"));
    const remaining = withoutPostedComment(posted, "c8");
    expect(remaining.map(({ id }) => id)).toEqual(["c9"]);
    const thread = summarizeCommentPages(page(0, ["c1"], { total: 1 }), [page(0, ["c1"], { startAt: 0, total: 1 })], remaining);
    expect(thread.comments.map(({ id }) => id)).toEqual(["c1", "c9"]);
    expect(withoutPostedComment(undefined, "c8")).toEqual([]);
  });

  it("ersetzt einen bearbeiteten eigenen Kommentar und lässt fremde Einträge unverändert", () => {
    const posted = withPostedComment(withPostedComment(undefined, { ...comment("c8"), body: "alt" }), comment("c9"));
    const edited = withEditedPostedComment(posted, "c8", "neu", "2026-11-10T09:00:00Z");
    expect(edited[0]).toMatchObject({ id: "c8", body: "neu", updated: "2026-11-10T09:00:00Z" });
    expect(edited[1]).toBe(posted[1]);
    expect(withEditedPostedComment(posted, "c7", "neu", "2026-11-10T09:00:00Z")).toEqual(posted);
    const thread = summarizeCommentPages(page(0, []), [], edited);
    expect(thread.comments.find(({ id }) => id === "c8")?.body).toBe("neu");
  });

  it("ersetzt einen eingebetteten Kommentar durch den Endpunkt-Eintrag mit parentId", () => {
    const thread = summarizeCommentPages(page(0, ["c1", "c2"]), [
      { requestedAt: 0, total: 2, comments: [comment("c1"), { ...comment("c2"), parentId: "c1" }] },
    ]);
    expect(thread.comments.find(({ id }) => id === "c2")?.parentId).toBe("c1");
  });
  it("behält die gesendete Antwort im Thread, wenn das Detail sie ohne parentId einbettet und Seite 0 sie nicht enthält", () => {
    const detail = page(0, ["c1", "c2", "c3"], { total: 3 });
    const posted = withPostedComment(undefined, { ...comment("c3"), parentId: "c1" });
    const thread = summarizeCommentPages(detail, [page(0, ["c1"], { startAt: 0, total: 3 })], posted);
    expect(thread.comments.find(({ id }) => id === "c3")?.parentId).toBe("c1");
    expect(thread.comments.map(({ id }) => id)).toEqual(["c1", "c2", "c3"]);
    expect(thread.loaded).toBe(3);
  });
});

describe("nur eingebettete Kommentare", () => {
  it("markiert Einträge, die weder eine Seite noch ein eigener Kommentar bestätigt", () => {
    const detail = page(0, ["c1", "c2", "c3", "c4"], { total: 4 });
    expect([...summarizeCommentPages(detail, []).embeddedOnly]).toEqual(["c1", "c2", "c3", "c4"]);
    const first = [page(0, ["c1", "c2"], { startAt: 0, total: 4 })];
    const posted = withPostedComment(undefined, { ...comment("c3"), parentId: "c1" });
    expect([...summarizeCommentPages(detail, first).embeddedOnly]).toEqual(["c3", "c4"]);
    expect([...summarizeCommentPages(detail, first, posted).embeddedOnly]).toEqual(["c4"]);
    const all = [...first, { requestedAt: 2, startAt: 2, total: 4, comments: [comment("c3"), { ...comment("c4"), parentId: "c1" }] }];
    expect(summarizeCommentPages(detail, all).embeddedOnly.size).toBe(0);
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
    expect(commentProgressLabel({ comments: [], loaded: 7, total: 8, incomplete: false })).toBe("7 von 8 Kommentaren geladen");
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

describe("Kommentarseiten nach einem Detailabruf", () => {
  const field = (total: number, ...entries: [string, string?][]) => ({ total, comments: entries.map(([id, updated]) => ({ id, updated })) });

  it("erkennt neue, bearbeitete und gelöschte eingebettete Kommentare", () => {
    const before = field(2, ["c1", "t1"], ["c2", "t1"]);
    expect(embeddedCommentsChanged(before, field(2, ["c1", "t1"], ["c2", "t1"]))).toBe(false);
    expect(embeddedCommentsChanged(before, field(3, ["c1", "t1"], ["c2", "t1"], ["c3", "t2"]))).toBe(true);
    expect(embeddedCommentsChanged(before, field(2, ["c1", "t1"], ["c2", "t2"]))).toBe(true);
    expect(embeddedCommentsChanged(before, field(1, ["c1", "t1"]))).toBe(true);
    expect(embeddedCommentsChanged(undefined, undefined)).toBe(false);
  });

  it("lädt nur ruhende Seiten neu, die älter sind als der Detailabruf", () => {
    expect(pagesOutdatedBy({ dataUpdatedAt: 100, fetchStatus: "idle" }, 200)).toBe(true);
    expect(pagesOutdatedBy({ dataUpdatedAt: 300, fetchStatus: "idle" }, 200)).toBe(false);
    expect(pagesOutdatedBy({ dataUpdatedAt: 100, fetchStatus: "fetching" }, 200)).toBe(false);
    expect(pagesOutdatedBy({ dataUpdatedAt: 0, fetchStatus: "idle" }, 200)).toBe(false);
    expect(pagesOutdatedBy(undefined, 200)).toBe(false);
  });
});
