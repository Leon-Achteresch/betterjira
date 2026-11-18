import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { issueApprovalsAllowed } from "./issue-approvals-capability";
import { readIssueApprovals } from "./issue-approvals";

const { transport, invoke } = vi.hoisted(() => ({
  transport: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: transport }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const cloudId = "fixture";
const siteUrl = "https://fixture.atlassian.net";
const accountId = "fixture-account";
const scope = { cloudId, siteUrl, isCurrent: () => true };
const identity = (id = accountId) => Response.json({ accountId: id });
const approval = { id: "1", name: "Prüfung", finalDecision: "approved" };
const readPage = (values: unknown[], isLastPage = true) =>
  Response.json({
    start: 0,
    isLastPage,
    size: values.length,
    limit: 8,
    values,
    _links: { next: "https://foreign.invalid/next" },
  });
const paths = () => transport.mock.calls.map(([url]) => new URL(url).pathname);
const approvalsPath =
  "/ex/jira/fixture/rest/servicedeskapi/request/DEMO-1/approval";
const accountPath = "/ex/jira/fixture/rest/api/3/myself";
const read = () =>
  Effect.runPromise(readIssueApprovals("DEMO-1", accountId, scope));

beforeEach(() => {
  transport.mockReset();
  invoke.mockResolvedValue(
    JSON.stringify({
      cloudId,
      siteUrl,
      siteName: "Fixture",
      accessToken: "synthetic",
      refreshToken: "synthetic",
      expiresAt: 9e12,
    }),
  );
});

it("prüft den typisierten JSM-GET, gibt nur sichtbare Namen aus und verfolgt keine Links", async () => {
  transport
    .mockResolvedValueOnce(identity())
    .mockResolvedValueOnce(
      readPage(
        [
          {
            ...approval,
            canAnswerApproval: true,
            approvers: [
              {
                approver: {
                  displayName: "Ada Test",
                  emailAddress: "nicht-anzeigen@example.test",
                },
              },
              {
                approver: { accountId: "hidden", name: "Verborgener Account" },
              },
              { approver: { displayName: " " } },
              { approver: { displayName: "Ada Test" } },
              { approver: null },
            ],
          },
        ],
        false,
      ),
    )
    .mockResolvedValueOnce(identity());
  await expect(read()).resolves.toEqual({
    partial: true,
    stages: [
      {
        id: "1",
        name: "Prüfung",
        decision: "approved",
        names: ["Ada Test"],
        moreNames: false,
      },
    ],
  });
  expect(paths()).toEqual([accountPath, approvalsPath, accountPath]);
  expect(new URL(transport.mock.calls[1]![0]).search).toBe("?start=0&limit=8");
  for (const [, init] of transport.mock.calls) {
    expect(init.method ?? "GET").toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(init.body).toBeUndefined();
  }
  expect(transport.mock.calls[1]![1].maxRedirections).toBe(0);
});

it.each([true, false])(
  "unterscheidet leere Seite und bestätigte Vollständigkeit (%s)",
  async (last) => {
    transport
      .mockResolvedValueOnce(identity())
      .mockResolvedValueOnce(readPage([], last))
      .mockResolvedValueOnce(identity());
    await expect(read()).resolves.toEqual({ partial: !last, stages: [] });
  },
);

it.each([
  { start: 0, isLastPage: true },
  { start: 0, isLastPage: true, size: 1, values: [] },
  { start: 1, isLastPage: true, values: [approval] },
  { start: 0, values: [] },
  { start: 0, isLastPage: true, values: [{ ...approval, finalDecision: " " }] },
  { start: 0, isLastPage: true, values: [approval, approval] },
  {
    start: 0,
    isLastPage: true,
    values: Array.from({ length: 9 }, (_, i) => ({
      ...approval,
      id: String(i),
    })),
  },
])("zeigt keine Daten aus unbestätigten Seiten %#", async (body) => {
  transport
    .mockResolvedValueOnce(identity())
    .mockResolvedValueOnce(Response.json(body));
  await expect(read()).rejects.toBeDefined();
  expect(paths()).toEqual([accountPath, approvalsPath]);
});

it.each([401, 403, 404, 503])(
  "gibt bei %i keine Daten aus und wiederholt den Request nicht",
  async (status) => {
    transport
      .mockResolvedValueOnce(identity())
      .mockResolvedValueOnce(new Response(null, { status }));
    await expect(read()).rejects.toMatchObject({
      _tag: "JiraApiError",
      status,
    });
    expect(paths()).toEqual([accountPath, approvalsPath]);
  },
);

it("verwirft die freigegebenen Felder, wenn der nachgelagerte Kontonachweis wechselt", async () => {
  transport
    .mockResolvedValueOnce(identity())
    .mockResolvedValueOnce(readPage([approval]))
    .mockResolvedValueOnce(identity("other"));
  await expect(read()).rejects.toMatchObject({
    _tag: "JiraRequestScopeChanged",
  });
  expect(paths()).toEqual([accountPath, approvalsPath, accountPath]);
});

it("weist ungültige Schlüssel und geänderten Scope vor dem Approval-GET ab", async () => {
  await expect(
    Effect.runPromise(readIssueApprovals("DEMO-1/../", accountId, scope)),
  ).rejects.toMatchObject({ _tag: "IssueApprovalsUnconfirmed" });
  await expect(
    Effect.runPromise(
      readIssueApprovals("DEMO-1", accountId, {
        ...scope,
        isCurrent: () => false,
      }),
    ),
  ).rejects.toMatchObject({ _tag: "JiraRequestScopeChanged" });
  expect(transport).not.toHaveBeenCalled();
  expect(issueApprovalsAllowed({ cloudId, accountId }, siteUrl)).toBe(false);
});
