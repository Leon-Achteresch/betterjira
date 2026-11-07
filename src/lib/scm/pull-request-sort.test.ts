import { describe, expect, it } from "vitest";
import type { PullRequest } from "./model";
import { pullRequestSortFrom, pullRequestSortParam, sortPullRequests } from "./pull-request-sort";
import { pullRequestsSearch, visiblePullRequests, type ListedPullRequest } from "./pull-requests";

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

describe("pullRequestSortParam", () => {
  it("lässt Standard, Unbekanntes und Fremdtypen weg", () => {
    expect(pullRequestSortParam("updated")).toBeUndefined();
    expect(pullRequestSortParam(undefined)).toBeUndefined();
    expect(pullRequestSortParam("UPDATED-ASC")).toBeUndefined();
    expect(pullRequestSortParam(["title"])).toBeUndefined();
    expect(pullRequestSortParam(3)).toBeUndefined();
    expect(pullRequestSortParam("updated-asc")).toBe("updated-asc");
    expect(pullRequestSortParam("title")).toBe("title");
    expect(pullRequestSortParam("repo")).toBe("repo");
  });

  it("erkennt den Standard als gültige Sortierung", () => {
    expect(pullRequestSortFrom("updated")).toBe("updated");
    expect(pullRequestSortFrom("zufall")).toBeUndefined();
  });

  it("steht in der validierten Suche neben Status, Text und Repository", () => {
    expect(pullRequestsSearch({ status: "merged", q: "farb", repo: "gh:github.com::qa/app", sort: "title" })).toEqual({
      status: "merged",
      q: "farb",
      repo: "gh:github.com::qa/app",
      sort: "title",
    });
    expect(pullRequestsSearch({ sort: "updated" }).sort).toBeUndefined();
    expect(pullRequestsSearch({ sort: "<script>" }).sort).toBeUndefined();
  });
});

describe("sortPullRequests", () => {
  const listed = [
    entry("mitte", { title: "beta", updatedAt: "2026-11-02T10:00:00Z" }, "qa/web"),
    entry("neu", { title: "Alpha", updatedAt: "2026-11-03T10:00:00Z" }, "qa/api"),
    entry("alt", { title: "gamma", updatedAt: "2026-11-01T10:00:00Z" }, "qa/api"),
  ];

  it("sortiert nach letzter oder ältester Aktualisierung", () => {
    expect(urls(sortPullRequests(listed, "updated"))).toEqual(["neu", "mitte", "alt"]);
    expect(urls(sortPullRequests(listed, "updated-asc"))).toEqual(["alt", "mitte", "neu"]);
  });

  it("sortiert Titel ohne Groß-/Kleinschreibung und Zahlen natürlich", () => {
    expect(urls(sortPullRequests(listed, "title"))).toEqual(["neu", "mitte", "alt"]);
    const numbered = [entry("zehn", { title: "PR 10" }), entry("zwei", { title: "PR 2" }), entry("umlaut", { title: "Änderung" })];
    expect(urls(sortPullRequests(numbered, "title"))).toEqual(["umlaut", "zwei", "zehn"]);
  });

  it("gruppiert nach Repository und darin nach letzter Aktualisierung", () => {
    expect(urls(sortPullRequests(listed, "repo"))).toEqual(["neu", "alt", "mitte"]);
  });

  it("vergleicht Zeitpunkte über Zeitzonen statt als Text", () => {
    const zones = [
      entry("berlin", { updatedAt: "2026-11-01T10:00:00+02:00" }),
      entry("utc", { updatedAt: "2026-11-01T09:00:00Z" }),
      entry("millis", { updatedAt: "2026-11-01T08:30:00.000+00:00" }),
    ];
    expect(urls(sortPullRequests(zones, "updated"))).toEqual(["utc", "millis", "berlin"]);
    expect(urls(sortPullRequests(zones, "updated-asc"))).toEqual(["berlin", "millis", "utc"]);
  });

  it("stellt fehlende oder ungültige Zeitpunkte in beiden Richtungen ans Ende", () => {
    const mixed = [
      entry("leer", { updatedAt: "" }),
      entry("früh", { updatedAt: "2026-11-01T10:00:00Z" }),
      entry("kaputt", { updatedAt: "gestern" }),
      entry("spät", { updatedAt: "2026-11-05T10:00:00Z" }),
    ];
    expect(urls(sortPullRequests(mixed, "updated"))).toEqual(["spät", "früh", "leer", "kaputt"]);
    expect(urls(sortPullRequests(mixed, "updated-asc"))).toEqual(["früh", "spät", "leer", "kaputt"]);
  });

  it("bleibt bei gleichen Schlüsseln stabil", () => {
    const same = ["a", "b", "c", "d"].map((url) => entry(url, { title: "Gleich", updatedAt: "2026-11-01T10:00:00Z" }));
    for (const sort of ["updated", "updated-asc", "title", "repo"] as const) expect(urls(sortPullRequests(same, sort))).toEqual(["a", "b", "c", "d"]);
    const reversed = [...same].reverse();
    expect(urls(sortPullRequests(reversed, "title"))).toEqual(["d", "c", "b", "a"]);
  });

  it("verändert die Eingabe nicht", () => {
    const frozen = Object.freeze([...listed]);
    const before = urls(frozen);
    const sorted = sortPullRequests(frozen, "updated-asc");
    expect(sorted).not.toBe(frozen);
    expect(urls(frozen)).toEqual(before);
    expect(sorted[0]).toBe(frozen[2]);
  });
});

describe("visiblePullRequests mit Sortierung", () => {
  const listed = [
    entry("b", { title: "Zuletzt", updatedAt: "2026-11-03T10:00:00Z" }),
    entry("a", { title: "Anfang", updatedAt: "2026-11-01T10:00:00Z" }),
    entry("d", { title: "Entwurf", state: "draft" }),
  ];

  it("filtert erst und sortiert dann", () => {
    expect(urls(visiblePullRequests(listed, "open", undefined))).toEqual(["b", "a"]);
    expect(urls(visiblePullRequests(listed, "open", undefined, "title"))).toEqual(["a", "b"]);
    expect(urls(visiblePullRequests(listed, "open", "zuletzt", "updated-asc"))).toEqual(["b"]);
  });
});
