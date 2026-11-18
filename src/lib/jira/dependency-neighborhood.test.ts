import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";

const { transport, invoke } = vi.hoisted(() => ({ transport: vi.fn(), invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: transport }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const siteUrl = "https://fixture.atlassian.net";
const scope = { cloudId: "fixture", siteUrl, isCurrent: () => true };
const relation = { typeId: "blocks", direction: "outward" } as const;
const link = (key: string, direction: "outward" | "inward" = "outward", type: string = relation.typeId) =>
  ({ type: { id: type }, [`${direction}Issue`]: { key } });
const success = (key: string, issuelinks: unknown[]) => Response.json({ key, fields: { issuelinks } });
const stub = (responses: Record<string, () => Response>) => {
  transport.mockImplementation((url: string) => {
    const path = new URL(url);
    expect(path.pathname).toContain("/ex/jira/fixture/rest/api/3/issue/");
    expect(path.searchParams.get("fields")).toBe("issuelinks");
    const key = path.pathname.split("/").at(-1)!;
    return Promise.resolve(responses[key]?.() ?? success(key, []));
  });
};
const calls = () => transport.mock.calls.map(([url]) => new URL(url).pathname.split("/").at(-1));
const load = async (requestScope = scope) => {
  const { readDependencyNeighborhood } = await import("./dependency-neighborhood");
  return Effect.runPromise(readDependencyNeighborhood("DEMO-1", relation, requestScope));
};

beforeEach(() => {
  vi.resetModules();
  transport.mockReset();
  invoke.mockReset().mockResolvedValue(JSON.stringify({
    cloudId: scope.cloudId, siteUrl, siteName: "Fixture",
    accessToken: "synthetic", refreshToken: "synthetic", expiresAt: 9e12,
  }));
});

it("dedupliziert Links und Tickets und erhält zwei Pfade und das Zyklusende", async () => {
  stub({
    "DEMO-1": () => success("DEMO-1", [link("DEMO-2"), link("demo-2"), link("DEMO-3"), link("FALSCH-1", "inward"), link("FALSCH-2", "outward", "other")]),
    "DEMO-2": () => success("DEMO-2", [link("OPS-7"), link("DEMO-1")]),
    "DEMO-3": () => success("DEMO-3", [link("OPS-7")]),
  });
  const result = await load();
  expect(calls()).toEqual(["DEMO-1", "DEMO-2", "DEMO-3"]);
  expect(result).toMatchObject({ reads: 3, edges: 5, unreadable: 0, nodes: [
    { key: "DEMO-1", via: ["DEMO-2"], depth: 0, state: "read" },
    { key: "DEMO-2", via: ["DEMO-1"], depth: 1, state: "read" },
    { key: "DEMO-3", via: ["DEMO-1"], depth: 1, state: "read" },
    { key: "OPS-7", via: ["DEMO-2", "DEMO-3"], depth: 2, state: "depth-limit" },
  ] });
});

it("begrenzt Tickets, Abrufe und den Scan langer Antworten", async () => {
  stub({ "DEMO-1": () => success("DEMO-1", Array.from({ length: 201 }, (_, i) => link(`OPS-${i + 1}`))) });
  const result = await load();
  expect(result.nodes).toHaveLength(20);
  expect(calls()).toHaveLength(8);
  expect(result.limits).toEqual({ nodes: true, edges: false, linksPerRead: true });
  expect(result.nodes.filter(({ state }) => state === "read-limit")).toHaveLength(12);
});

it("begrenzt zusätzliche Pfade auch zwischen bereits bekannten Tickets", async () => {
  const keys = Array.from({ length: 8 }, (_, i) => `OP-${i + 1}`);
  stub(Object.fromEntries(["DEMO-1", ...keys].map((key) => [key, () => success(key, keys.map((target) => link(target)))])));
  const result = await load();
  expect(result.edges).toBe(40);
  expect(result.limits.edges).toBe(true);
  expect(new Set(result.nodes.map(({ key }) => key)).size).toBe(result.nodes.length);
});

it("trennt fehlende Rechte, unbekannte Antworten und nicht auswertbare Links", async () => {
  stub({
    "DEMO-1": () => success("DEMO-1", [link("DEMO-2"), link("DEMO-3"), link("DEMO-4"), { type: { id: "blocks" } }]),
    "DEMO-2": () => new Response(null, { status: 403 }),
    "DEMO-3": () => new Response(null, { status: 404 }),
    "DEMO-4": () => Response.json({ key: "DEMO-4", fields: {} }),
  });
  const result = await load();
  expect(result.unreadable).toBe(1);
  expect(result.nodes.map(({ state }) => state)).toEqual(["read", "forbidden", "unavailable", "missing-links"]);
});

it("gibt bei einem Wechsel während des ersten Reads keinen Teilstand zurück", async () => {
  let current = true;
  stub({ "DEMO-1": () => {
    current = false;
    return success("DEMO-1", [link("DEMO-2")]);
  } });
  await expect(load({ ...scope, isCurrent: () => current })).rejects.toMatchObject({ _tag: "DependencyContextChanged" });
  expect(calls()).toEqual(["DEMO-1"]);
});
