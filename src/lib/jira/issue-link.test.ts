import { describe, expect, it } from "vitest";
import { jiraCommentUrl } from "./comment-link";
import { appLinkTarget, issueRouteSearch, issueSearch, parseCommentSearch, parseIssueLink, withoutCommentSearch } from "./issue-link";

const SITE = "https://example.atlassian.net";

describe("Ticket-Links derselben Site", () => {
  it("liest Schlüssel und Kommentar-ID aus focusedCommentId", () => {
    expect(parseIssueLink(`${SITE}/browse/DEMO-2?focusedCommentId=20012`, SITE)).toEqual({ issueKey: "DEMO-2", commentId: "20012" });
  });

  it("liest die Kommentar-ID aus dem Anker #comment-{id}", () => {
    expect(parseIssueLink(`${SITE}/browse/DEMO-2#comment-20012`, SITE)).toEqual({ issueKey: "DEMO-2", commentId: "20012" });
  });

  it("liest den Link, den Link kopieren erzeugt", () => {
    expect(parseIssueLink(jiraCommentUrl(SITE, "DEMO-1", "10002") ?? "", SITE)).toEqual({ issueKey: "DEMO-1", commentId: "10002" });
  });

  it("liest einen Ticket-Link ohne Kommentar", () => {
    expect(parseIssueLink(`${SITE}/browse/demo-3/`, SITE)).toEqual({ issueKey: "DEMO-3" });
  });

  it("ignoriert eine Kommentar-ID, die keine Zahl ist", () => {
    expect(parseIssueLink(`${SITE}/browse/DEMO-2?focusedCommentId=abc`, SITE)).toEqual({ issueKey: "DEMO-2" });
  });

  it("lehnt fremde Sites, andere Pfade und ungültige URLs ab", () => {
    expect(parseIssueLink("https://other.atlassian.net/browse/DEMO-2", SITE)).toBeUndefined();
    expect(parseIssueLink(`${SITE}/jira/software/projects/DEMO/boards/1`, SITE)).toBeUndefined();
    expect(parseIssueLink(`${SITE}/browse/DEMO`, SITE)).toBeUndefined();
    expect(parseIssueLink("kein link", SITE)).toBeUndefined();
  });

  it("lehnt einen Schlüssel mit kaputter Prozent-Kodierung ab, statt zu werfen", () => {
    expect(parseIssueLink(`${SITE}/browse/%E0%A4%A`, SITE)).toBeUndefined();
  });
});

describe("Links in der App öffnen", () => {
  it("öffnet Ticket-Links ohne Kommentar-ID in der App", () => {
    expect(appLinkTarget(`${SITE}/browse/DEMO-3`, SITE)).toEqual({ issueKey: "DEMO-3" });
  });

  it("öffnet Kommentar-Links mit Kommentar in der App", () => {
    expect(appLinkTarget(`${SITE}/browse/DEMO-2?focusedCommentId=20012`, SITE)).toEqual({ issueKey: "DEMO-2", commentId: "20012" });
  });

  it("lässt andere Links und eine fehlende Site beim Browser", () => {
    expect(appLinkTarget("https://example.com/doku", SITE)).toBeUndefined();
    expect(appLinkTarget(`${SITE}/browse/DEMO-3`, undefined)).toBeUndefined();
  });
});

describe("Suchparameter comment", () => {
  it("nimmt Zahl und Zeichenkette aus Ziffern an", () => {
    expect(parseCommentSearch({ comment: 10002 })).toEqual({ comment: "10002" });
    expect(parseCommentSearch({ comment: "10002" })).toEqual({ comment: "10002" });
    expect(parseCommentSearch({ comment: "x" })).toEqual({});
    expect(parseCommentSearch({})).toEqual({});
  });

  it("setzt comment nur mit Kommentar-ID", () => {
    expect(issueSearch("10002")).toEqual({ comment: "10002" });
    expect(issueSearch(undefined)).toEqual({});
  });
});

describe("Suchparameter der Ticket-Route", () => {
  it("nimmt Bereich und Kommentar zusammen an und verwirft Unbekanntes", () => {
    expect(issueRouteSearch({ bereich: "zeit", comment: 10002 })).toEqual({ bereich: "zeit", comment: "10002" });
    expect(issueRouteSearch({ bereich: "zeit" })).toEqual({ bereich: "zeit" });
    expect(issueRouteSearch({ comment: "10002" })).toEqual({ comment: "10002" });
    expect(issueRouteSearch({ bereich: "andere", comment: "x", fremd: 1 })).toEqual({});
  });

  it("entfernt nach dem Sprung nur den Kommentar und behält den Bereich", () => {
    expect(withoutCommentSearch({ bereich: "zeit", comment: "10002" })).toEqual({ bereich: "zeit" });
    expect(withoutCommentSearch({ comment: "10002" })).toEqual({});
  });
});
