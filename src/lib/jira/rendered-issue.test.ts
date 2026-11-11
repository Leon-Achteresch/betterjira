import { describe, expect, it } from "vitest";
import { commentPagePath } from "./comment-pages";
import { jiraKeys } from "./keys";
import { renderedComment, renderedDescription, renderedIssuePath, toRenderedIssue, type RenderedSource } from "./rendered-issue";

describe("gerenderte Fassung", () => {
  it("fragt nur Beschreibung und Kommentare mit renderedFields ab", () => {
    expect(renderedIssuePath("DEMO-1")).toBe("/issue/DEMO-1?fields=description,comment&expand=renderedFields");
  });
  it("liest Beschreibung und Kommentar-HTML je Kommentar-ID", () => {
    expect(
      toRenderedIssue({ renderedFields: { description: "<p>a</p>", comment: { comments: [{ id: "1", body: "<p>b</p>" }, { id: "2", body: null }] } } }),
    ).toEqual({ description: "<p>a</p>", comments: { "1": "<p>b</p>" } });
  });
  it("kommt ohne renderedFields aus", () => {
    expect(toRenderedIssue({})).toEqual({ description: undefined, comments: {} });
    expect(toRenderedIssue({ renderedFields: null })).toEqual({ description: undefined, comments: {} });
  });
});

describe("Schlüssel der gerenderten Fassung", () => {
  const scope = { cloudId: "cloud", accountId: "account" };
  it("liegt neben dem Ticketschlüssel, damit invalidateIssueChange sie nicht unter altem Stand neu lädt", () => {
    const key = jiraKeys.issueRendered("DEMO-1", "2026-11-04T10:00:00Z", scope);
    expect(key).toEqual(["jira", "issue-rendered", "DEMO-1", "2026-11-04T10:00:00Z", "cloud", "account"]);
    expect(key.slice(0, jiraKeys.issue("DEMO-1").length)).not.toEqual([...jiraKeys.issue("DEMO-1")]);
  });
  it("wechselt mit dem Stand des Tickets", () => {
    expect(jiraKeys.issueRendered("DEMO-1", "2026-11-04T10:00:00Z", scope)).not.toEqual(jiraKeys.issueRendered("DEMO-1", "2026-11-05T10:00:00Z", scope));
  });
});

describe("gerenderte Fassung je Dokument", () => {
  const ready: RenderedSource = { status: "ready", issue: { description: "<p>d</p>", comments: { "7": "<p>c</p>" } } };
  it("gibt der Beschreibung Zustand und HTML", () => {
    expect(renderedDescription({ status: "off" })).toBeUndefined();
    expect(renderedDescription({ status: "loading" })).toEqual({ status: "loading" });
    expect(renderedDescription({ status: "error" })).toEqual({ status: "error" });
    expect(renderedDescription(ready)).toEqual({ status: "ready", html: "<p>d</p>" });
    expect(renderedDescription({ status: "ready", issue: { comments: {} } })).toEqual({ status: "ready", html: "" });
  });
  it("nimmt für Kommentare renderedBody vor der Ticketfassung", () => {
    expect(renderedComment({ status: "loading" }, "7", "<p>seite</p>")).toEqual({ status: "ready", html: "<p>seite</p>" });
    expect(renderedComment(ready, "7", undefined)).toEqual({ status: "ready", html: "<p>c</p>" });
    expect(renderedComment(ready, "8", null)).toEqual({ status: "ready", html: "" });
    expect(renderedComment({ status: "loading" }, "7", undefined)).toEqual({ status: "loading" });
    expect(renderedComment({ status: "error" }, "7", undefined)).toEqual({ status: "error" });
    expect(renderedComment({ status: "off" }, "7", undefined)).toBeUndefined();
    expect(renderedComment(undefined, "7", undefined)).toBeUndefined();
  });
});

describe("Kommentarseiten", () => {
  it("laden renderedBody mit und behalten die bisherigen Parameter", () => {
    const params = new URLSearchParams(commentPagePath("DEMO-1", 50).split("?")[1]);
    expect(Object.fromEntries(params)).toEqual({ startAt: "50", maxResults: "50", orderBy: "created", expand: "renderedBody" });
  });
});
