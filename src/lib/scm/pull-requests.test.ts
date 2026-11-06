import { describe, expect, it } from "vitest";
import type { PullRequest, ScmConnection } from "./model";
import { listStateFor, pullRequestsSearch, pullRequestTargets, visiblePullRequests, type ListedPullRequest } from "./pull-requests";

const connection: ScmConnection = {
  id: "gh:github.com",
  kind: "github",
  label: "GitHub",
  baseUrl: "https://github.com",
  account: "qa",
  auth: { kind: "gh", host: "github.com" },
};

const pr = (overrides: Partial<PullRequest>): PullRequest => ({
  url: "https://github.com/qa/app/pull/1",
  number: 1,
  title: "Login prüfen",
  state: "open",
  source: "feature/DEMO-1",
  target: "main",
  author: { name: "Alex", avatarUrl: null },
  updatedAt: "2026-11-01T10:00:00Z",
  checks: null,
  reviewers: [],
  ...overrides,
});

describe("pullRequestsSearch", () => {
  it("übernimmt nur gültige Werte und lässt den Standardstatus weg", () => {
    expect(pullRequestsSearch({ status: "merged", q: "login p", repo: "gh:github.com::qa/app" })).toEqual({
      status: "merged",
      q: "login p",
      repo: "gh:github.com::qa/app",
    });
    expect(pullRequestsSearch({ status: "open", q: "   ", repo: 3 })).toEqual({ status: undefined, q: undefined, repo: undefined });
    expect(pullRequestsSearch({ status: "unbekannt" }).status).toBeUndefined();
  });

  it("begrenzt die Suchlänge", () => {
    expect(pullRequestsSearch({ q: "x".repeat(500) }).q).toHaveLength(200);
  });
});

describe("listStateFor", () => {
  it("lädt Entwürfe über die offene Liste", () => {
    expect(listStateFor("draft")).toBe("open");
    expect(listStateFor("closed")).toBe("closed");
  });
});

describe("pullRequestTargets", () => {
  it("entfernt doppelt verknüpfte Repositories und markiert fehlende Verbindungen", () => {
    const targets = pullRequestTargets(
      {
        DEMO: [
          { connectionId: "gh:github.com", repo: "qa/web" },
          { connectionId: "gone", repo: "qa/api" },
        ],
        OPS: [{ connectionId: "gh:github.com", repo: "qa/web" }],
      },
      [connection],
    );
    expect(targets.map(({ id, connection }) => [id, connection?.id ?? null])).toEqual([
      ["gone::qa/api", null],
      ["gh:github.com::qa/web", "gh:github.com"],
    ]);
  });
});

describe("visiblePullRequests", () => {
  const listed: ListedPullRequest[] = [
    { pr: pr({ url: "a", number: 7, title: "Alt", updatedAt: "2026-11-01T10:00:00Z" }), repo: "qa/app", repoId: "x" },
    { pr: pr({ url: "b", number: 8, title: "Neu", updatedAt: "2026-11-03T10:00:00Z" }), repo: "qa/api", repoId: "y" },
    { pr: pr({ url: "c", number: 9, title: "Entwurf", state: "draft" }), repo: "qa/app", repoId: "x" },
  ];

  it("filtert nach Status und sortiert nach Aktualisierung", () => {
    expect(visiblePullRequests(listed, "open", undefined).map(({ pr }) => pr.url)).toEqual(["b", "a"]);
    expect(visiblePullRequests(listed, "draft", undefined).map(({ pr }) => pr.url)).toEqual(["c"]);
  });

  it("sucht in Titel, Nummer, Branch, Person und Repository", () => {
    expect(visiblePullRequests(listed, "open", "#7").map(({ pr }) => pr.url)).toEqual(["a"]);
    expect(visiblePullRequests(listed, "open", "QA/API").map(({ pr }) => pr.url)).toEqual(["b"]);
    expect(visiblePullRequests(listed, "open", "demo-1")).toHaveLength(2);
    expect(visiblePullRequests(listed, "open", "niemand")).toHaveLength(0);
  });
});
