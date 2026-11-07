import { describe, expect, it } from "vitest";
import type { CheckState, PullRequest } from "./model";
import {
  PULL_REQUEST_CHECK_FILTERS,
  PULL_REQUEST_CHECK_FILTER_LABELS,
  matchesCheckFilter,
  pullRequestCheckFilterFrom,
  pullRequestCheckFilterParam,
  type PullRequestCheckFilter,
} from "./pull-request-checks";
import { pullRequestEmptyReason, pullRequestsSearch, visiblePullRequests, type ListedPullRequest } from "./pull-requests";

const entry = (url: string, overrides: Partial<PullRequest> = {}, repo = "qa/app"): ListedPullRequest => ({
  pr: {
    url,
    number: 1,
    title: "Login prüfen",
    state: "open",
    source: "feature/DEMO-1",
    target: "main",
    author: null,
    updatedAt: "2026-11-01T10:00:00Z",
    checks: null,
    reviewers: [],
    ...overrides,
  },
  repo,
  repoId: repo,
});

const urls = (entries: readonly ListedPullRequest[]) => entries.map(({ pr }) => pr.url);

const STATES: Array<CheckState | null> = ["success", "failure", "pending", null];

describe("pullRequestCheckFilterParam", () => {
  it("lässt Standard, Unbekanntes und Fremdtypen weg", () => {
    for (const value of ["all", undefined, null, "", "FAILURE", "erfolgreich", ["failure"], 1, { failure: true }])
      expect(pullRequestCheckFilterParam(value)).toBeUndefined();
    expect(pullRequestCheckFilterParam("failure")).toBe("failure");
    expect(pullRequestCheckFilterParam("pending")).toBe("pending");
    expect(pullRequestCheckFilterParam("success")).toBe("success");
    expect(pullRequestCheckFilterParam("unknown")).toBe("unknown");
  });

  it("erkennt den Standard als gültigen Filter", () => {
    expect(pullRequestCheckFilterFrom("all")).toBe("all");
    expect(pullRequestCheckFilterFrom("none")).toBeUndefined();
  });

  it("steht in der validierten Suche neben Status, Text, Repository und Sortierung", () => {
    expect(pullRequestsSearch({ status: "merged", q: "farb", repo: "gh:github.com::qa/app", sort: "title", checks: "failure" })).toEqual({
      status: "merged",
      q: "farb",
      repo: "gh:github.com::qa/app",
      sort: "title",
      checks: "failure",
    });
    expect(pullRequestsSearch({ checks: "all" }).checks).toBeUndefined();
    expect(pullRequestsSearch({ checks: "<script>" }).checks).toBeUndefined();
    expect(pullRequestsSearch({}).checks).toBeUndefined();
  });

  it("bezeichnet fehlende Angaben nie als erfolgreich oder als fehlende Tests", () => {
    expect(PULL_REQUEST_CHECK_FILTERS).toEqual(["all", "failure", "pending", "success", "unknown"]);
    expect(PULL_REQUEST_CHECK_FILTER_LABELS.unknown).toBe("Keine Angabe");
    expect(PULL_REQUEST_CHECK_FILTER_LABELS.unknown).not.toMatch(/erfolg|test/i);
  });
});

describe("matchesCheckFilter", () => {
  const expected: Record<PullRequestCheckFilter, Array<CheckState | null>> = {
    all: ["success", "failure", "pending", null],
    failure: ["failure"],
    pending: ["pending"],
    success: ["success"],
    unknown: [null],
  };

  it("ordnet jeden Prüfzustand genau seinem Filter zu", () => {
    for (const filter of PULL_REQUEST_CHECK_FILTERS)
      expect(STATES.filter((state) => matchesCheckFilter(state, filter))).toEqual(expected[filter]);
  });

  it("zählt fehlende Angaben nicht als erfolgreich", () => {
    expect(matchesCheckFilter(null, "success")).toBe(false);
    expect(matchesCheckFilter("success", "unknown")).toBe(false);
  });
});

describe("visiblePullRequests mit Prüfstatus", () => {
  const listed = [
    entry("ok-neu", { title: "Beta", checks: "success", updatedAt: "2026-11-05T10:00:00Z" }, "qa/web"),
    entry("rot", { title: "Alpha", checks: "failure", updatedAt: "2026-11-04T10:00:00Z" }, "qa/api"),
    entry("läuft", { title: "Gamma", checks: "pending", updatedAt: "2026-11-03T10:00:00Z" }),
    entry("ohne", { title: "Delta", checks: null, updatedAt: "2026-11-02T10:00:00Z" }),
    entry("ok-alt", { title: "Epsilon", checks: "success", updatedAt: "2026-11-01T10:00:00Z" }),
    entry("entwurf-rot", { title: "Zeta", checks: "failure", state: "draft" }),
    entry("gemergt", { title: "Eta", checks: null, state: "merged" }),
  ];

  it("filtert jeden Prüfzustand innerhalb des Status", () => {
    expect(urls(visiblePullRequests(listed, "open", undefined))).toEqual(["ok-neu", "rot", "läuft", "ohne", "ok-alt"]);
    expect(urls(visiblePullRequests(listed, "open", undefined, "updated", "all"))).toEqual(["ok-neu", "rot", "läuft", "ohne", "ok-alt"]);
    expect(urls(visiblePullRequests(listed, "open", undefined, "updated", "failure"))).toEqual(["rot"]);
    expect(urls(visiblePullRequests(listed, "open", undefined, "updated", "pending"))).toEqual(["läuft"]);
    expect(urls(visiblePullRequests(listed, "open", undefined, "updated", "success"))).toEqual(["ok-neu", "ok-alt"]);
    expect(urls(visiblePullRequests(listed, "open", undefined, "updated", "unknown"))).toEqual(["ohne"]);
    expect(urls(visiblePullRequests(listed, "draft", undefined, "updated", "failure"))).toEqual(["entwurf-rot"]);
    expect(urls(visiblePullRequests(listed, "merged", undefined, "updated", "unknown"))).toEqual(["gemergt"]);
    expect(urls(visiblePullRequests(listed, "merged", undefined, "updated", "success"))).toEqual([]);
  });

  it("kombiniert Prüfstatus mit Suche und sortiert erst danach", () => {
    expect(urls(visiblePullRequests(listed, "open", "qa/app", "updated", "all"))).toEqual(["läuft", "ohne", "ok-alt"]);
    expect(urls(visiblePullRequests(listed, "open", "qa/app", "updated", "success"))).toEqual(["ok-alt"]);
    expect(urls(visiblePullRequests(listed, "open", undefined, "title", "success"))).toEqual(["ok-neu", "ok-alt"]);
    expect(urls(visiblePullRequests(listed, "open", undefined, "updated-asc", "success"))).toEqual(["ok-alt", "ok-neu"]);
    expect(urls(visiblePullRequests(listed, "open", undefined, "repo", "success"))).toEqual(["ok-alt", "ok-neu"]);
    expect(urls(visiblePullRequests(listed, "open", "  ", "title", "failure"))).toEqual(["rot"]);
  });

  it("filtert nur die übergebenen Einträge eines Repositorys", () => {
    const repoOnly = listed.filter(({ repoId }) => repoId === "qa/web");
    expect(urls(visiblePullRequests(repoOnly, "open", undefined, "updated", "success"))).toEqual(["ok-neu"]);
    expect(urls(visiblePullRequests(repoOnly, "open", undefined, "updated", "failure"))).toEqual([]);
  });

  it("verändert die Eingabe nicht", () => {
    const frozen = Object.freeze([...listed]);
    expect(urls(visiblePullRequests(frozen, "open", undefined, "title", "success"))).toEqual(["ok-neu", "ok-alt"]);
    expect(urls(frozen)).toEqual(urls(listed));
  });
});

describe("pullRequestEmptyReason", () => {
  const listed = [
    entry("rot", { title: "Login", checks: "failure" }),
    entry("ohne", { title: "Suche", checks: null }),
    entry("gemergt", { title: "Alt", state: "merged", checks: "success" }),
  ];

  it("meldet keinen Leerzustand, solange etwas sichtbar ist", () => {
    expect(pullRequestEmptyReason(listed, "open", undefined)).toBeNull();
    expect(pullRequestEmptyReason(listed, "open", "login", "failure")).toBeNull();
    expect(pullRequestEmptyReason(listed, "open", undefined, "unknown")).toBeNull();
  });

  it("unterscheidet leeren Status, fehlende Suchtreffer und Prüfstatus", () => {
    expect(pullRequestEmptyReason(listed, "closed", undefined)).toBe("status");
    expect(pullRequestEmptyReason(listed, "closed", "login", "failure")).toBe("status");
    expect(pullRequestEmptyReason(listed, "open", "niemand")).toBe("query");
    expect(pullRequestEmptyReason(listed, "open", "niemand", "failure")).toBe("query");
    expect(pullRequestEmptyReason(listed, "open", undefined, "success")).toBe("checks");
    expect(pullRequestEmptyReason(listed, "open", undefined, "pending")).toBe("checks");
    expect(pullRequestEmptyReason(listed, "open", "suche", "failure")).toBe("checks");
    expect(pullRequestEmptyReason(listed, "merged", undefined, "unknown")).toBe("checks");
    expect(pullRequestEmptyReason([], "open", undefined, "failure")).toBe("status");
  });
});
