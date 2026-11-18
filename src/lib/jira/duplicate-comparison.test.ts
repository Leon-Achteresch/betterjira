import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import type { IssueLinkReference } from "./issue-links";

const { transport, invoke } = vi.hoisted(() => ({
  transport: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: transport }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const host = "https://fixture.atlassian.net";
const type = {
  id: "10004",
  name: "Duplicate",
  inward: "is duplicated by",
  outward: "duplicates",
};
const reference: IssueLinkReference = {
  id: "42",
  typeId: type.id,
  typeName: type.name,
  direction: "outward",
  duplicate: true,
};
const edge = (key: string, direction: "inward" | "outward") => ({
  id: "42",
  type,
  [`${direction}Issue`]: { key },
});
const issue = (key: string, issuelinks: unknown[], fields = {}) =>
  Response.json({ key, fields: { ...fields, issuelinks } });
const paths = () =>
  transport.mock.calls.map(([url]) => new URL(url).pathname.split("/").at(-1));
const account = () => Response.json({ accountId: "fixture-account" });
const load = async (
  link = reference,
  from = "DEMO-1",
  to = "DEMO-2",
  isCurrent = () => true,
) => {
  const { readDuplicateComparison } = await import("./duplicate-comparison");
  return Effect.runPromise(
    readDuplicateComparison(from, to, link, "fixture-account", {
      cloudId: "fixture",
      siteUrl: host,
      isCurrent,
    }),
  );
};

beforeEach(() => {
  vi.resetModules();
  transport.mockReset();
  invoke.mockReset().mockResolvedValue(
    JSON.stringify({
      cloudId: "fixture",
      siteUrl: host,
      siteName: "Fixture",
      accessToken: "synthetic",
      refreshToken: "synthetic",
      expiresAt: 9e12,
    }),
  );
});

it.each(["outward", "inward"] as const)(
  "prüft Konto und Link an beiden Enden, Richtung %s",
  async (direction) => {
    const outward = direction === "outward";
    transport
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce(
        issue("DEMO-1", [edge("DEMO-2", direction)], {
          summary: "Titel 1",
          priority: { name: "Hoch" },
        }),
      )
      .mockResolvedValueOnce(
        issue("DEMO-2", [edge("DEMO-1", outward ? "inward" : "outward")], {
          summary: null,
          priority: { anonymized: true },
          status: { name: "Offen" },
          issuetype: { name: "Bug" },
          assignee: { displayName: "Privat" },
        }),
      )
      .mockResolvedValueOnce(account());
    const result = await load({ ...reference, direction });
    const first = { key: "DEMO-1", summary: "Titel 1", priority: "Hoch" };
    const second = { key: "DEMO-2", status: "Offen", issueType: "Bug" };
    expect(result).toMatchObject(
      outward
        ? { duplicate: first, original: second }
        : { duplicate: second, original: first },
    );
    expect(result[outward ? "original" : "duplicate"]).toEqual({
      ...second,
      priority: undefined,
      summary: undefined,
    });
    expect(paths()).toEqual(["myself", "DEMO-1", "DEMO-2", "myself"]);
    for (const [url, init] of transport.mock.calls) {
      expect(init.method ?? "GET").toBe("GET");
      expect(init.body).toBeUndefined();
      expect(init.cache).toBe("no-store");
      if (url.includes("/issue/"))
        expect(new URL(url).searchParams.get("fields")).toBe(
          "summary,status,issuetype,priority,issuelinks",
        );
    }
  },
);

it.each([
  [],
  [edge("DEMO-2", "inward")],
  [edge("DEMO-3", "outward")],
  [{ ...edge("DEMO-2", "outward"), type: { ...type, inward: "blocks" } }],
  [edge("DEMO-2", "outward"), { id: "42", type: null }],
])(
  "überspringt ein Ziel ohne eindeutig bestätigten Ausgangslink %#",
  async (...links) => {
    transport
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce(issue("DEMO-1", links));
    await expect(load()).rejects.toMatchObject({
      _tag: "DuplicateLinkUnconfirmed",
    });
    expect(paths()).toEqual(["myself", "DEMO-1"]);
  },
);

it("sperrt einen gewöhnlichen oder selbstbezogenen Link vor dem Abruf", async () => {
  await expect(
    load({ ...reference, duplicate: undefined }),
  ).rejects.toMatchObject({ _tag: "DuplicateLinkUnconfirmed" });
  await expect(load(reference, "DEMO-1", "DEMO-1")).rejects.toMatchObject({
    _tag: "DuplicateLinkUnconfirmed",
  });
  expect(transport).not.toHaveBeenCalled();
});

it.each([403, 404, 503])(
  "gibt bei Zielstatus %i keine Teildaten zurück",
  async (status) => {
    transport
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce(issue("DEMO-1", [edge("DEMO-2", "outward")]))
      .mockResolvedValueOnce(new Response(null, { status }));
    await expect(load()).rejects.toMatchObject({
      _tag: "JiraApiError",
      status,
    });
    expect(paths()).toEqual(["myself", "DEMO-1", "DEMO-2"]);
  },
);

it("verwirft verwechslte Tickets und eine fehlende Rückrichtung", async () => {
  const current = () => issue("DEMO-1", [edge("DEMO-2", "outward")]);
  transport
    .mockResolvedValueOnce(account())
    .mockResolvedValueOnce(current())
    .mockResolvedValueOnce(issue("DEMO-3", [edge("DEMO-1", "inward")]))
    .mockResolvedValueOnce(account())
    .mockResolvedValueOnce(current())
    .mockResolvedValueOnce(issue("DEMO-2", [edge("DEMO-1", "outward")]));
  await expect(load()).rejects.toMatchObject({
    _tag: "DuplicateLinkUnconfirmed",
  });
  await expect(load()).rejects.toMatchObject({
    _tag: "DuplicateLinkUnconfirmed",
  });
  expect(paths()).toEqual([
    "myself",
    "DEMO-1",
    "DEMO-2",
    "myself",
    "DEMO-1",
    "DEMO-2",
  ]);
});

it("verwirft nach einer verspäteten Antwort sowohl den geänderten Kontonachweis als auch den verlorenen Requestscope", async () => {
  let current = true;
  const first = () => issue("DEMO-1", [edge("DEMO-2", "outward")]);
  const second = () => issue("DEMO-2", [edge("DEMO-1", "inward")]);
  transport
    .mockResolvedValueOnce(account())
    .mockResolvedValueOnce(first())
    .mockResolvedValueOnce(second())
    .mockResolvedValueOnce(Response.json({ accountId: "other-account" }))
    .mockResolvedValueOnce(account())
    .mockResolvedValueOnce(first())
    .mockImplementationOnce(async () => {
      current = false;
      return second();
    });
  await expect(load()).rejects.toMatchObject({
    _tag: "JiraRequestScopeChanged",
  });
  await expect(
    load(reference, "DEMO-1", "DEMO-2", () => current),
  ).rejects.toMatchObject({ _tag: "JiraRequestScopeChanged" });
  expect(paths()).toEqual([
    "myself",
    "DEMO-1",
    "DEMO-2",
    "myself",
    "myself",
    "DEMO-1",
    "DEMO-2",
  ]);
});
