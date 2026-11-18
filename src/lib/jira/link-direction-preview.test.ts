import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { summarizeIssueLinks, type IssueLinkDirection } from "./issue-links";
import { readLinkDirectionPreview } from "./link-direction-preview";

const { transport, invoke } = vi.hoisted(() => ({
  transport: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: transport }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const cloudId = "qa-link-direction";
const siteUrl = "https://fixture.atlassian.net";
const accountId = "fixture-account";
const type = {
  id: "23",
  name: "Blocks",
  inward: "is blocked by",
  outward: "blocks",
};
const edge = (
  key = "DEMO-2",
  direction: IssueLinkDirection = "outward",
  id = "42",
) => ({ id, type, [`${direction}Issue`]: { key } });
const reference = summarizeIssueLinks([edge()]).groups[0]!.issues[0]!.link!;
const ticket = (key: string, ...issuelinks: unknown[]) =>
  Response.json({ key, fields: { issuelinks } });
const account = (id = accountId) => Response.json({ accountId: id });
const calls = () =>
  transport.mock.calls.map(([url, init]) => [
    init.method ?? "GET",
    new URL(url).pathname.split("/api/3")[1],
    new URL(url).search,
    init.cache,
    init.body,
  ]);
const read = (
  direction: IssueLinkDirection = "outward",
  isCurrent = () => true,
  host = siteUrl,
) =>
  Effect.runPromise(
    readLinkDirectionPreview(
      "DEMO-1",
      "DEMO-2",
      { ...reference, direction },
      accountId,
      { cloudId, siteUrl: host, isCurrent },
    ),
  );

beforeEach(() => {
  transport.mockReset();
  invoke.mockReset().mockResolvedValue(
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

it.each(["outward", "inward"] as const)(
  "liest genau beide Enden und stellt beide Perspektiven gegenüber (%s)",
  async (direction) => {
    const opposite = direction === "outward" ? "inward" : "outward";
    transport
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce(ticket("DEMO-1", edge("DEMO-2", direction)))
      .mockResolvedValueOnce(ticket("DEMO-2", edge("DEMO-1", opposite)))
      .mockResolvedValueOnce(account());
    expect(await read(direction)).toEqual({
      typeName: "Blocks",
      typeId: "23",
      current: [
        { from: "DEMO-1", to: "DEMO-2", label: type[direction] },
        { from: "DEMO-2", to: "DEMO-1", label: type[opposite] },
      ],
      reversed: [
        { from: "DEMO-1", to: "DEMO-2", label: type[opposite] },
        { from: "DEMO-2", to: "DEMO-1", label: type[direction] },
      ],
    });
    expect(
      transport.mock.calls.every(([url]) =>
        new URL(url).pathname.startsWith(`/ex/jira/${cloudId}/rest/api/3/`),
      ),
    ).toBe(true);
    expect(calls()).toEqual([
      ["GET", "/myself", "", "no-store", undefined],
      ["GET", "/issue/DEMO-1", "?fields=issuelinks", "no-store", undefined],
      ["GET", "/issue/DEMO-2", "?fields=issuelinks", "no-store", undefined],
      ["GET", "/myself", "", "no-store", undefined],
    ]);
  },
);

it.each([
  { name: "entfernt", links: [] },
  { name: "neue Link-ID", links: [edge("DEMO-2", "outward", "93")] },
  { name: "anderer Typ", links: [{ ...edge(), type: { ...type, id: "99" } }] },
  {
    name: "andere Gegenrichtung",
    links: [{ ...edge(), type: { ...type, inward: "blocks back" } }],
  },
  {
    name: "inzwischen symmetrisch",
    links: [{ ...edge(), type: { ...type, inward: " Blocks " } }],
  },
  { name: "doppelte Link-ID", links: [edge(), { id: "42", type: null }] },
  {
    name: "umgekehrte Kante existiert",
    links: [edge(), edge("DEMO-2", "inward", "51")],
  },
  {
    name: "beide Slots",
    links: [{ ...edge(), inwardIssue: { key: "DEMO-2" } }],
  },
])(
  "stoppt vor dem Ziel bei geändertem oder unklarem Link ($name)",
  async ({ links }) => {
    transport
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce(ticket("DEMO-1", ...links));
    await expect(read()).rejects.toMatchObject({
      _tag: "LinkDirectionUnconfirmed",
    });
    expect(calls().map((row) => row[1])).toEqual(["/myself", "/issue/DEMO-1"]);
  },
);

it("bietet bei identischen, fehlenden oder in einer Zeile zusammengefassten Labels keine Richtungswahl an", () => {
  for (const links of [
    [{ ...edge(), type: { ...type, inward: " ＢＬＯＣＫＳ " } }],
    [{ ...edge(), type: { ...type, inward: "" } }],
    [{ ...edge(), id: " " }],
    [
      edge(),
      { ...edge("DEMO-2", "outward", "88"), type: { ...type, id: "88" } },
    ],
  ]) {
    const [row] = summarizeIssueLinks(links).groups[0]!.issues;
    expect(row?.link?.directed).toBeUndefined();
  }
});

it.each([403, 404, 503])(
  "liefert ohne lesbares Ziel kein Ergebnis und wiederholt den GET nicht (%i)",
  async (status) => {
    transport
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce(ticket("DEMO-1", edge()))
      .mockResolvedValueOnce(new Response(null, { status }));
    await expect(read()).rejects.toMatchObject({
      _tag: "JiraApiError",
      status,
    });
    expect(calls().map((row) => row[1])).toEqual([
      "/myself",
      "/issue/DEMO-1",
      "/issue/DEMO-2",
    ]);
  },
);

it.each([
  {
    failure: "falsche Richtung am Ziel",
    key: "DEMO-2",
    reverse: edge("DEMO-1"),
  },
  {
    failure: "falsche Ticketantwort",
    key: "DEMO-3",
    reverse: edge("DEMO-1", "inward"),
  },
])(
  "braucht den reziproken Link und das richtige Ticket ($failure)",
  async ({ key, reverse }) => {
    transport
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce(ticket("DEMO-1", edge()))
      .mockResolvedValueOnce(ticket(key, reverse));
    await expect(read()).rejects.toMatchObject({
      _tag: "LinkDirectionUnconfirmed",
    });
    expect(transport).toHaveBeenCalledTimes(3);
  },
);

it("publiziert nach Konto- oder Scopeverlust auch bei lesbaren Endpunkten keine Vorschau", async () => {
  let current = true;
  transport
    .mockResolvedValueOnce(account())
    .mockResolvedValueOnce(ticket("DEMO-1", edge()))
    .mockResolvedValueOnce(ticket("DEMO-2", edge("DEMO-1", "inward")))
    .mockResolvedValueOnce(account("new-account"))
    .mockResolvedValueOnce(account())
    .mockResolvedValueOnce(ticket("DEMO-1", edge()))
    .mockImplementationOnce(async () => {
      current = false;
      return ticket("DEMO-2", edge("DEMO-1", "inward"));
    });
  await expect(read()).rejects.toMatchObject({
    _tag: "JiraRequestScopeChanged",
  });
  await expect(read("outward", () => current)).rejects.toMatchObject({
    _tag: "JiraRequestScopeChanged",
  });
  expect(transport).toHaveBeenCalledTimes(7);
});

it("liest bei abweichender Site derselben Cloud-ID kein Ticket", async () => {
  await expect(
    read("outward", () => true, "https://other.atlassian.net"),
  ).rejects.toMatchObject({
    _tag: "JiraRequestScopeChanged",
  });
  expect(transport).not.toHaveBeenCalled();
});
