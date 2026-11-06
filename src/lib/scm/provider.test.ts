import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import type { ScmConnection } from "./model";
import { providerFor } from "./provider";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

type Request = { url: string; method: string; body: string | null };

const respond = (handler: (request: Request) => unknown) =>
  invoke.mockImplementation(async (_command: string, request: Request) => {
    const body = handler(request);
    return typeof body === "number" ? { status: body, body: "{}" } : { status: 200, body: JSON.stringify(body) };
  });

const github: ScmConnection = {
  id: "gh:github.com",
  kind: "github",
  label: "GitHub",
  baseUrl: "https://github.com",
  account: "qa",
  auth: { kind: "gh", host: "github.com" },
};
const cloud: ScmConnection = {
  id: "cloud",
  kind: "bitbucket-cloud",
  label: "Bitbucket Cloud",
  baseUrl: "https://bitbucket.org",
  account: null,
  auth: { kind: "token", id: "cloud", username: "qa" },
};
const server: ScmConnection = {
  id: "dc",
  kind: "bitbucket-dc",
  label: "Bitbucket Data Center",
  baseUrl: "https://git.example.test",
  account: null,
  auth: { kind: "token", id: "dc", username: null },
};

const graphPullRequest = (number: number, state: "OPEN" | "MERGED", isDraft = false) => ({
  number,
  title: `DEMO-1 Änderung ${number}`,
  url: `https://github.com/qa/app/pull/${number}`,
  state,
  isDraft,
  headRefName: "feature/DEMO-1",
  baseRefName: "main",
  updatedAt: "2026-11-04T10:00:00Z",
  author: { login: "alex", avatarUrl: "https://example.test/a.png" },
  latestReviews: { nodes: [{ state: "APPROVED", author: { login: "kim", avatarUrl: "https://example.test/k.png" } }] },
  reviewRequests: { nodes: [{ requestedReviewer: { login: "sam", avatarUrl: "https://example.test/s.png" } }] },
  commits: { nodes: [{ commit: { statusCheckRollup: { state: "FAILURE" } } }] },
});

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

beforeEach(() => {
  invoke.mockReset();
});

describe("GitHub", () => {
  it("listet Pull Requests eines Repositorys begrenzt und erkennt weitere Seiten", async () => {
    respond(() => ({
      data: { repository: { pullRequests: { totalCount: 30, nodes: [graphPullRequest(1, "OPEN", true), graphPullRequest(2, "OPEN")] } } },
    }));
    const page = await run(providerFor("github").pullRequests(github, "qa/app", "open"));
    const sent = JSON.parse(invoke.mock.calls[0]?.[1].body);
    expect(sent.variables).toEqual({ owner: "qa", name: "app", states: ["OPEN"], first: 25 });
    expect(page.truncated).toBe(true);
    expect(page.pullRequests[0]).toMatchObject({ number: 1, state: "draft", checks: "failure" });
    expect(page.pullRequests[1]?.reviewers).toEqual([
      { name: "kim", avatarUrl: "https://example.test/k.png", state: "approved" },
      { name: "sam", avatarUrl: "https://example.test/s.png", state: "pending" },
    ]);
  });

  it("meldet fehlende Repositories als Fehler", async () => {
    respond(() => ({ data: { repository: null }, errors: [{ message: "Could not resolve to a Repository" }] }));
    await expect(run(providerFor("github").pullRequests(github, "qa/gone", "merged"))).rejects.toMatchObject({
      message: "Could not resolve to a Repository",
    });
  });

  it("findet weiterhin ticketbezogene Pull Requests und Branches", async () => {
    respond(() => ({
      data: {
        search: { nodes: [graphPullRequest(4, "MERGED")] },
        repository: { refs: { nodes: [{ name: "feature/DEMO-1", associatedPullRequests: { nodes: [graphPullRequest(4, "MERGED")] } }, { name: "feature/DEMO-12", associatedPullRequests: { nodes: [] } }] } },
      },
    }));
    const development = await run(providerFor("github").development(github, "qa/app", "DEMO-1"));
    expect(development.pullRequests.map(({ number, state }) => [number, state])).toEqual([[4, "merged"]]);
    expect(development.branches).toEqual([{ name: "feature/DEMO-1", url: "https://github.com/qa/app/tree/feature/DEMO-1" }]);
  });
});

describe("Bitbucket Cloud", () => {
  it("listet geschlossene Pull Requests ohne Checks und erkennt die nächste Seite", async () => {
    respond(({ url }) => {
      expect(url).toContain("/repositories/qa/api/pullrequests?state=DECLINED&state=SUPERSEDED&pagelen=25&sort=-updated_on");
      return {
        values: [
          {
            id: 3,
            title: "Abgelehnt",
            state: "DECLINED",
            updated_on: "2026-11-02T09:00:00Z",
            author: { display_name: "Kim", links: {} },
            source: { branch: { name: "fix/x" }, commit: null },
            destination: { branch: { name: "main" } },
            links: { html: { href: "https://bitbucket.org/qa/api/pull-requests/3" } },
            participants: [{ user: { display_name: "Sam", links: {} }, role: "REVIEWER", approved: true }],
          },
        ],
        next: "https://api.bitbucket.org/2.0/next",
      };
    });
    const page = await run(providerFor("bitbucket-cloud").pullRequests(cloud, "qa/api", "closed"));
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(page).toEqual({
      truncated: true,
      pullRequests: [
        expect.objectContaining({ number: 3, state: "closed", checks: null, reviewers: [{ name: "Sam", avatarUrl: null, state: "approved" }] }),
      ],
    });
    expect(providerFor("bitbucket-cloud").pullRequestsUrl(cloud, "qa/api")).toBe("https://bitbucket.org/qa/api/pull-requests");
  });
});

describe("Bitbucket Data Center", () => {
  it("listet offene Pull Requests mit Build-Status und letzter Seite", async () => {
    respond(({ url }) => {
      if (url.includes("/build-status/")) return { successful: 2, failed: 0, inProgress: 1 };
      expect(url).toBe("https://git.example.test/rest/api/latest/projects/QA/repos/web/pull-requests?state=OPEN&order=NEWEST&limit=25");
      return {
        isLastPage: true,
        values: [
          {
            id: 9,
            title: "Neue Ansicht",
            state: "OPEN",
            draft: true,
            updatedDate: Date.UTC(2026, 10, 3),
            author: { user: { displayName: "Alex" } },
            fromRef: { displayId: "feature/view", latestCommit: "abc" },
            toRef: { displayId: "main" },
            reviewers: [{ user: { displayName: "Jo" }, status: "NEEDS_WORK" }],
            links: { self: [{ href: "https://git.example.test/projects/QA/repos/web/pull-requests/9" }] },
          },
        ],
      };
    });
    const page = await run(providerFor("bitbucket-dc").pullRequests(server, "QA/web", "open"));
    expect(page.truncated).toBe(false);
    expect(page.pullRequests[0]).toMatchObject({
      number: 9,
      state: "draft",
      checks: "pending",
      updatedAt: "2026-11-03T00:00:00.000Z",
      reviewers: [{ name: "Jo", avatarUrl: null, state: "changes" }],
    });
  });

  it("gibt HTTP-Fehler als ScmApiError weiter", async () => {
    respond(() => 401);
    await expect(run(providerFor("bitbucket-dc").pullRequests(server, "QA/web", "merged"))).rejects.toMatchObject({
      _tag: "ScmApiError",
      status: 401,
    });
  });
});
