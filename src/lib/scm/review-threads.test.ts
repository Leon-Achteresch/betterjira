import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import {
  bitbucketReviewOriginal,
  readReviewThreads,
  reviewThreadsError,
} from "./review-threads";

const { invoke, allowed } = vi.hoisted(() => ({
  invoke: vi.fn(),
  allowed: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@/lib/scm/review-threads-capability", () => ({
  reviewThreadsAllowed: allowed,
}));

const repo = "QA/web-app";
const url = "https://github.com/QA/web-app/pull/41";
const connection = {
  id: "gh:github.com",
  baseUrl: "https://github.com",
  account: "qa-user",
  label: "GitHub",
  kind: "github" as const,
  auth: { kind: "gh" as const, host: "github.com" },
};
const subject = { connection, repo, pr: { url, number: 41 } };
const node = (
  id: string,
  resolved: boolean,
  outdated: boolean,
  link?: string,
) => ({
  id,
  path: `src/${id}.ts`,
  isResolved: resolved,
  isOutdated: outdated,
  comments: { nodes: link ? [{ url: link }] : [] },
});
const page = (
  nodes: unknown[],
  hasNextPage = false,
  totalCount = nodes.length,
) => ({ totalCount, nodes, pageInfo: { hasNextPage } });
const read = (current = () => true) =>
  Effect.runPromise(readReviewThreads(subject, current));
const response = (
  threads: unknown,
  login = "QA-user",
  repoName = "qa/web-app",
  pr = subject.pr,
) => ({
  data: {
    viewer: { login },
    repository: {
      nameWithOwner: repoName,
      pullRequest: { ...pr, reviewThreads: threads },
    },
  },
});
const reply = (value: unknown, status = 200) => ({
  status,
  body: JSON.stringify(value),
});

beforeEach(() => {
  invoke.mockReset();
  allowed.mockReset().mockReturnValue(true);
});

it("fragt genau die getrennten Flags des bestätigten PR ab und zeigt ein offenes veraltetes Gespräch", async () => {
  invoke.mockResolvedValueOnce(
    reply(
      response(
        page([
          node("open", false, true, url + "#discussion_r14"),
          node("done", true, false),
        ]),
      ),
    ),
  );
  await expect(read()).resolves.toEqual({
    partial: false,
    threads: [
      {
        id: "open",
        path: "src/open.ts",
        resolved: false,
        outdated: true,
        url: url + "#discussion_r14",
      },
      {
        id: "done",
        path: "src/done.ts",
        resolved: true,
        outdated: false,
        url: undefined,
      },
    ],
  });
  expect(invoke).toHaveBeenCalledTimes(1);
  const [command, request] = invoke.mock.calls[0]!;
  expect(command).toBe("scm_request");
  expect(request).toMatchObject({
    auth: connection.auth,
    url: "https://api.github.com/graphql",
    method: "POST",
  });
  const body = JSON.parse(request.body);
  expect(body.query).toMatch(/^\s*query N23ReviewThreads\(/);
  expect(body.query).toContain(
    "id path isResolved isOutdated comments(first: 1) { nodes { url } }",
  );
  expect(body.query).not.toMatch(
    /\bmutation\b|bodyHTML|bodyText|viewerCanResolve/,
  );
  expect(body.variables).toEqual({
    owner: "QA",
    name: "web-app",
    number: 41,
    first: 8,
  });
});

it.each([
  "https://other.invalid/QA/web-app/pull/41#discussion_r14",
  "https://github.com/QA/other/pull/41#discussion_r14",
  "https://github.com/QA/web-app/pull/42#discussion_r14",
  "https://qa@github.com/QA/web-app/pull/41#discussion_r14",
  "https://github.com/QA/web-app/pull/41?redirect=1#discussion_r14",
  "http://github.com/QA/web-app/pull/41#discussion_r14",
  "https://github.com/QA/web-app/pull/41#issuecomment-14",
])("zeigt keinen Link bei ungeeignetem Provider-Original %s", async (link) => {
  invoke.mockResolvedValueOnce(
    reply(response(page([node("open", false, true, link)]))),
  );
  await expect(read()).resolves.toMatchObject({
    threads: [{ resolved: false, outdated: true, url: undefined }],
  });
});

it("unterscheidet bestätigte Leere, Teildaten und fehlende Abdeckung", async () => {
  invoke
    .mockResolvedValueOnce(reply(response(page([]))))
    .mockResolvedValueOnce(
      reply({
        ...response(
          page(
            [node("known", false, true), { id: "missing", isOutdated: true }],
            true,
            13,
          ),
        ),
        errors: [{ type: "INTERNAL" }],
      }),
    )
    .mockResolvedValueOnce(reply(response(null)));
  await expect(read()).resolves.toEqual({ threads: [], partial: false });
  await expect(read()).resolves.toMatchObject({
    threads: [{ id: "known", resolved: false }],
    partial: true,
  });
  await expect(read()).rejects.toMatchObject({
    _tag: "ReviewThreadsUnconfirmed",
  });
});

it.each([
  response(page([]), "other"),
  response(page([]), connection.account, "qa/other"),
  response(page([]), connection.account, repo, { number: 42, url }),
  response(page([]), connection.account, repo, {
    number: 41,
    url: "https://foreign.invalid/QA/web-app/pull/41",
  }),
  response(page([node("same", false, false), node("same", true, true)])),
  response(
    page(
      Array.from({ length: 9 }, (_, index) => node(String(index), false, true)),
    ),
  ),
])("verwirft unbestätigte Identität oder Antwortgrenze %#", async (body) => {
  invoke.mockResolvedValueOnce(reply(body));
  await expect(read()).rejects.toMatchObject({
    _tag: "ReviewThreadsUnconfirmed",
  });
});

it("unterdrückt HTTP- und GraphQL-Rechtefehler auch mit gelieferten Teildaten", async () => {
  invoke
    .mockResolvedValueOnce(reply({}, 403))
    .mockResolvedValueOnce(
      reply({
        ...response(page([node("hidden", false, false)])),
        errors: [{ type: "FORBIDDEN" }],
      }),
    );
  for (let i = 0; i < 2; i++)
    await expect(read().catch(reviewThreadsError)).resolves.toContain(
      "Kein bestätigter Lesezugriff",
    );
  expect(invoke).toHaveBeenCalledTimes(2);
});

it("blockiert das reguläre Gate, ungültige Ausgangs-URLs und späte Antworten", async () => {
  allowed.mockReturnValueOnce(false);
  await expect(read()).rejects.toMatchObject({
    _tag: "ReviewThreadsUnconfirmed",
  });
  await expect(
    Effect.runPromise(
      readReviewThreads(
        { ...subject, pr: { ...subject.pr, url: "https://foreign.invalid/x" } },
        () => true,
      ),
    ),
  ).rejects.toMatchObject({ _tag: "ReviewThreadsUnconfirmed" });
  expect(invoke).not.toHaveBeenCalled();
  let active = true;
  invoke.mockImplementationOnce(async () => {
    active = false;
    return reply(response(page([])));
  });
  await expect(read(() => active)).rejects.toMatchObject({
    _tag: "ReviewThreadsUnconfirmed",
  });
});

it("verweist bei Bitbucket Cloud ausschließlich auf einen passenden PR", () => {
  const bitbucket = {
    ...subject,
    connection: {
      ...connection,
      kind: "bitbucket-cloud" as const,
      baseUrl: "https://bitbucket.org",
    },
    pr: {
      ...subject.pr,
      url: "https://bitbucket.org/QA/web-app/pull-requests/41",
    },
  };
  expect(bitbucketReviewOriginal(bitbucket)).toBe(bitbucket.pr.url);
  expect(
    bitbucketReviewOriginal({ ...bitbucket, repo: "qa/other" }),
  ).toBeUndefined();
  expect(invoke).not.toHaveBeenCalled();
});
