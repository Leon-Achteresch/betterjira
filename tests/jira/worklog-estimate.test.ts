import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { addWorklog } from "@/lib/jira/issue";

const { transport, invoke, allowed } = vi.hoisted(() => ({
  transport: vi.fn(),
  invoke: vi.fn(),
  allowed: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: transport }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@/lib/jira/worklog-estimate-capability", () => ({
  worklogEstimateAllowed: allowed,
}));

const siteUrl = "https://fixture.atlassian.net";
const cloudId = "fixture";
const accountId = "account";
const identity = (id = accountId) => Response.json({ accountId: id });
const body = {
  timeSpent: "1h",
  started: "2026-11-15T09:00:00.000+0100",
  comment: "Synthetischer Test",
};
const scope = { siteUrl, cloudId, accountId, isCurrent: () => true };
const write = (value = "0", overrides = {}) =>
  Effect.runPromise(
    addWorklog("DEMO-1", {
      ...body,
      remainingEstimate: {
        issueId: "1",
        value,
        scope: { ...scope, ...overrides },
      },
    }),
  );
const paths = () => transport.mock.calls.map(([url]) => new URL(url).pathname);

beforeEach(() => {
  transport.mockReset();
  allowed.mockReset().mockReturnValue(true);
  invoke.mockResolvedValue(
    JSON.stringify({
      siteUrl,
      cloudId,
      siteName: "Fixture",
      accessToken: "synthetic",
      refreshToken: "synthetic",
      expiresAt: 9e12,
    }),
  );
});

it("hält den bisherigen Standard ohne Optionsparameter und ohne Extra-Request", async () => {
  transport.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await Effect.runPromise(addWorklog("DEMO-1", body));
  expect(transport).toHaveBeenCalledTimes(1);
  const [url, request] = transport.mock.calls[0]!;
  expect(new URL(url).pathname).toBe(
    "/ex/jira/fixture/rest/api/2/issue/DEMO-1/worklog",
  );
  expect(new URL(url).search).toBe("");
  expect(request).toMatchObject({ method: "POST", body: JSON.stringify(body) });
});

it.each([
  ["0", "0m"],
  ["02H 030m", "2h 30m"],
])(
  "sendet %s über denselben QA-POST wie die Zeitbuchung",
  async (value, normalized) => {
    const dispatched = vi.fn();
    transport
      .mockResolvedValueOnce(identity())
      .mockResolvedValueOnce(
        Response.json({ id: "work-1", issueId: "1" }, { status: 201 }),
      );
    await write(value, { onDispatch: dispatched });
    expect(paths()).toEqual([
      "/ex/jira/fixture/rest/api/3/myself",
      "/ex/jira/fixture/rest/api/2/issue/1/worklog",
    ]);
    const [url, request] = transport.mock.calls[1]!;
    expect(Object.fromEntries(new URL(url).searchParams)).toEqual({
      adjustEstimate: "new",
      newEstimate: normalized,
    });
    expect(request).toMatchObject({
      method: "POST",
      body: JSON.stringify(body),
      maxRedirections: 0,
    });
    expect(dispatched).toHaveBeenCalledTimes(1);
  },
);

it.each(["", "-1h", "0m 0m"])(
  "blockiert ungültige ausdrückliche Vorgabe %j",
  async (bad) => {
    await expect(write(bad)).rejects.toMatchObject({ status: 400 });
    expect(transport).not.toHaveBeenCalled();
  },
);

it("blockiert den Dienst ohne QA-Freigabe und bei schon verlorenem Scope", async () => {
  allowed.mockReturnValueOnce(false);
  await expect(write()).rejects.toMatchObject({
    _tag: "JiraRequestScopeChanged",
  });
  await expect(write("0", { isCurrent: () => false })).rejects.toMatchObject({
    _tag: "JiraRequestScopeChanged",
  });
  expect(transport).not.toHaveBeenCalled();
});

it("sendet nach falschem Konto oder verlorener Ticket-/Sitzungsbindung keinen POST", async () => {
  let current = true;
  transport
    .mockResolvedValueOnce(identity("other"))
    .mockImplementationOnce(async () => {
      current = false;
      return identity();
    });
  await expect(write()).rejects.toMatchObject({
    _tag: "JiraRequestScopeChanged",
  });
  await expect(write("0", { isCurrent: () => current })).rejects.toMatchObject({
    _tag: "JiraRequestScopeChanged",
  });
  expect(paths()).toEqual(Array(2).fill("/ex/jira/fixture/rest/api/3/myself"));
});

it.each([401, 403, 503])(
  "wiederholt den POST nach Status %i nicht",
  async (status) => {
    transport
      .mockResolvedValueOnce(identity())
      .mockResolvedValueOnce(new Response(null, { status }));
    await expect(write()).rejects.toMatchObject({ status });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(
      invoke.mock.calls.every(([command]) => command === "session_get"),
    ).toBe(true);
  },
);

it("behandelt eine bestätigte Buchung am falschen Ticket als unklar", async () => {
  transport
    .mockResolvedValueOnce(identity())
    .mockResolvedValueOnce(
      Response.json({ id: "work-1", issueId: "2" }, { status: 201 }),
    );
  await expect(write()).rejects.toMatchObject({
    _tag: "WorklogBookingUnconfirmed",
  });
  expect(transport).toHaveBeenCalledTimes(2);
});
