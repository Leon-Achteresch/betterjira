import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";

const { transport, invoke } = vi.hoisted(() => ({
  transport: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: transport }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const account = (accountId = "qa-a") => Response.json({ accountId });
const scope = {
  cloudId: "fixture",
  siteUrl: "https://fixture.atlassian.net",
  isCurrent: () => true,
};
const suffix = (url: string) => url.split("/rest/api/3")[1];
const load = async () =>
  Effect.runPromise(
    (await import("./saved-filters")).fetchSavedFilters("qa-a", scope),
  );

beforeEach(() => {
  vi.resetModules();
  transport.mockReset();
  invoke.mockReset().mockResolvedValue(
    JSON.stringify({
      cloudId: scope.cloudId,
      siteUrl: scope.siteUrl,
      siteName: "Fixture",
      accessToken: "synthetic",
      refreshToken: "synthetic",
      expiresAt: 9e12,
    }),
  );
});

it("bindet den offiziellen Listenread an das Konto und dedupliziert nach Filter-ID", async () => {
  transport
    .mockResolvedValueOnce(account())
    .mockResolvedValueOnce(
      Response.json([
        { id: "1", name: "Eigener Favorit", jql: null },
        {
          id: "1",
          name: "Eigener Favorit",
          favourite: true,
          jql: "project = DEMO",
        },
        { id: "2", name: "Fehlend", jql: { redacted: true } },
        { id: "3", name: "Widersprüchlich", jql: "project = EX" },
        { id: "3", name: "Widersprüchlich", jql: "project = DEMO" },
      ]),
    )
    .mockResolvedValueOnce(account());
  expect(await load()).toEqual([
    {
      id: "1",
      name: "Eigener Favorit",
      favourite: true,
      jql: "project = DEMO",
    },
    { id: "2", name: "Fehlend", favourite: false, jql: undefined },
    { id: "3", name: "Widersprüchlich", favourite: false, jql: undefined },
  ]);
  expect(transport.mock.calls.map(([url]) => suffix(url))).toEqual([
    "/myself",
    "/filter/my?includeFavourites=true&expand=jql",
    "/myself",
  ]);
  expect(
    transport.mock.calls.every(
      ([, init]) =>
        (init.method ?? "GET") === "GET" && init.cache === "no-store",
    ),
  ).toBe(true);
});

it("liest keine Liste nach einem Kontowechsel und verwirft eine spät gelieferte Liste", async () => {
  transport.mockResolvedValueOnce(account("qa-b"));
  await expect(load()).rejects.toMatchObject({
    _tag: "JiraRequestScopeChanged",
  });
  expect(transport).toHaveBeenCalledTimes(1);
  transport
    .mockResolvedValueOnce(account())
    .mockResolvedValueOnce(
      Response.json([{ id: "1", name: "Veraltet", jql: "project = DEMO" }]),
    )
    .mockResolvedValueOnce(account("qa-b"));
  await expect(load()).rejects.toMatchObject({
    _tag: "JiraRequestScopeChanged",
  });
  expect(transport.mock.calls.map(([url]) => suffix(url))).toEqual([
    "/myself",
    "/myself",
    "/filter/my?includeFavourites=true&expand=jql",
    "/myself",
  ]);
});
