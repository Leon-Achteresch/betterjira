import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { QueryClient } from "@tanstack/react-query";
import { executePlanning, patchPlanning, planningJql, planningNeighbors, rollbackPlanning } from "./board-planning";
import { planningConfigQuery, planningSprintsQuery } from "./board-planning-query";
import { jiraKeys } from "./keys";

const { http, invoke } = vi.hoisted(() => ({ http: vi.fn(), invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: http }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const item = (id: number) => ({ id: String(id), key: `DEMO-${id}`, fields: { summary: `Aufgabe ${id}` } });
const session = { accessToken: "qa", refreshToken: "qa", expiresAt: 9e12, cloudId: "test", siteUrl: "https://jira.test", siteName: "Test" };

beforeEach(() => {
  http.mockReset();
  invoke.mockReset();
  invoke.mockResolvedValue(JSON.stringify(session));
  http.mockResolvedValue(new Response(null, { status: 204 }));
});

describe("planning commands", () => {
  it("uses a neighbor issue id and the board rank field instead of sending display indices", async () => {
    await Effect.runPromise(executePlanning({ kind: "rank", key: "DEMO-2", neighborId: "10001", direction: "before", rankFieldId: 123 }));
    expect(http).toHaveBeenCalledOnce();
    const [url, init] = http.mock.calls[0]!;
    expect(url).toContain("/rest/agile/1.0/issue/rank");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ issues: ["DEMO-2"], rankBeforeIssue: "10001", rankCustomFieldId: 123 });
  });

  it("moves to a sprint and back to backlog through their dedicated endpoints", async () => {
    await Effect.runPromise(executePlanning({ kind: "sprint", key: "DEMO-2", sprintId: 5 }));
    await Effect.runPromise(executePlanning({ kind: "backlog", key: "DEMO-2" }));
    expect(http.mock.calls.map(([url]) => url)).toEqual([
      "https://api.atlassian.com/ex/jira/test/rest/agile/1.0/sprint/5/issue",
      "https://api.atlassian.com/ex/jira/test/rest/agile/1.0/backlog/issue",
    ]);
    expect(http.mock.calls.map(([, init]) => JSON.parse(init.body))).toEqual([{ issues: ["DEMO-2"] }, { issues: ["DEMO-2"] }]);
  });

  it("validates 207 responses for the specific issue instead of treating them as success", async () => {
    http.mockResolvedValueOnce(Response.json({ entries: [{ issueId: 2, issueKey: "DEMO-2", status: 503, errors: ["Rang gesperrt"] }] }, { status: 207 }));
    await expect(Effect.runPromise(executePlanning({ kind: "rank", key: "DEMO-2", neighborId: "1", direction: "after" }))).rejects.toMatchObject({ status: 503, body: "Rang gesperrt" });
    expect(http).toHaveBeenCalledOnce();
    http.mockResolvedValueOnce(Response.json({ entries: [{ issueId: 2, issueKey: "DEMO-2", status: 200 }] }, { status: 207 }));
    await expect(Effect.runPromise(executePlanning({ kind: "rank", key: "DEMO-2", neighborId: "1", direction: "after" }))).resolves.toBeUndefined();
  });

  it("rejects partial responses which omit the changed issue", async () => {
    http.mockResolvedValueOnce(Response.json({ entries: [{ issueId: 9, issueKey: "DEMO-9", status: 200 }] }, { status: 207 }));
    await expect(Effect.runPromise(executePlanning({ kind: "rank", key: "DEMO-2", neighborId: "1", direction: "before" }))).rejects.toMatchObject({ status: 502 });
  });

  it("preserves permission errors and never automatically repeats a failed write", async () => {
    http.mockResolvedValueOnce(Response.json({ errorMessages: ["No scheduling permission"] }, { status: 403 }));
    await expect(Effect.runPromise(executePlanning({ kind: "sprint", key: "DEMO-2", sprintId: 5 }))).rejects.toMatchObject({ status: 403 });
    expect(http).toHaveBeenCalledOnce();
  });

  it("rejects invalid targets without any network request", async () => {
    await expect(Effect.runPromise(executePlanning({ kind: "sprint", key: "DEMO-2", sprintId: NaN }))).rejects.toMatchObject({ _tag: "PlanningInputError" });
    await expect(Effect.runPromise(executePlanning({ kind: "rank", key: "DEMO-2", neighborId: "DEMO-2", direction: "before" }))).rejects.toMatchObject({ _tag: "PlanningInputError" });
    expect(http).not.toHaveBeenCalled();
  });

  it("never sends a queued change after its account scope becomes invalid", async () => {
    await expect(Effect.runPromise(executePlanning(
      { kind: "sprint", key: "DEMO-2", sprintId: 5 },
      { cloudId: "test", isCurrent: () => false },
    ))).rejects.toBeDefined();
    expect(http).not.toHaveBeenCalled();
  });
});

describe("planning lists", () => {
  it("isolates metadata for identical board ids across sites and accounts", () => {
    const client = new QueryClient();
    const scopes = [
      { cloudId: "first", accountId: "me" },
      { cloudId: "second", accountId: "me" },
      { cloudId: "first", accountId: "other" },
    ];
    const configs = scopes.map((scope) => planningConfigQuery(client, 1, scope).queryKey);
    const sprints = scopes.map((scope) => planningSprintsQuery(client, 1, scope).queryKey);
    expect(new Set(configs.map((key) => JSON.stringify(key))).size).toBe(3);
    expect(new Set(sprints.map((key) => JSON.stringify(key))).size).toBe(3);
    client.setQueryData(jiraKeys.boardConfig(1), { filter: { id: "old" } });
    client.setQueryData(jiraKeys.boardSprints(1), [{ id: 99 }]);
    for (const key of [...configs, ...sprints]) expect(client.getQueryData(key)).toBeUndefined();
    client.clear();
  });

  it("rolls back the original scoped cache without touching another account or newer server data", () => {
    const client = new QueryClient();
    const key = jiraKeys.boardPlanning(1, "old", "backlog");
    const otherKey = jiraKeys.boardPlanning(1, "new", "backlog");
    const before = { pages: [{ issues: [item(1), item(2)], isLast: true }], pageParams: [undefined] };
    const changed = patchPlanning(before, { kind: "rank", key: "DEMO-2", neighborId: "1", direction: "before" });
    client.setQueryData(key, changed);
    const optimistic = client.getQueryData<typeof changed>(key);
    client.setQueryData(otherKey, { separate: true });
    rollbackPlanning(client, key, { before, optimistic });
    expect(client.getQueryData(key)).toEqual(before);
    expect(client.getQueryData(otherKey)).toEqual({ separate: true });
    client.setQueryData(key, { ...before, pages: [{ issues: [item(3)], isLast: true }] });
    rollbackPlanning(client, key, { before, optimistic });
    expect(client.getQueryData(key)).toMatchObject({ pages: [{ issues: [{ key: "DEMO-3" }] }] });
    client.clear();
  });

  it("keeps page boundaries and tokens while optimistically changing rank", () => {
    const data = { pages: [{ issues: [item(1), item(2)], nextPageToken: "next", isLast: false }, { issues: [item(3)], isLast: true }], pageParams: [undefined, "next"] };
    const moved = patchPlanning(data, { kind: "rank", key: "DEMO-3", neighborId: "2", direction: "before" });
    expect(moved?.pages.map(({ issues }) => issues.map(({ id }) => id))).toEqual([["1", "3"], ["2"]]);
    expect(moved?.pageParams).toEqual(data.pageParams);
    expect(moved?.pages[0]?.nextPageToken).toBe("next");
    expect(data.pages[0]?.issues.map(({ id }) => id)).toEqual(["1", "2"]);
    expect(patchPlanning(data, { kind: "backlog", key: "DEMO-1" })?.pages.flatMap(({ issues }) => issues).map(({ id }) => id)).toEqual(["2", "3"]);
  });

  it("uses actual loaded neighbors and disables moves beyond a page boundary until loaded", () => {
    const issues = [item(2), item(7), item(5)];
    expect(planningNeighbors(issues, "DEMO-2")).toEqual({ before: undefined, after: item(7) });
    expect(planningNeighbors(issues, "DEMO-5")).toEqual({ before: item(7), after: undefined });
    expect(planningNeighbors(issues, "unknown")).toEqual({ before: undefined, after: undefined });
  });

  it("requests backlog or a specific sprint ordered by the configured rank", () => {
    expect(planningJql("100", "backlog")).toBe("filter = 100 AND (sprint is EMPTY OR sprint not in openSprints() AND sprint not in futureSprints()) AND statusCategory != Done ORDER BY Rank ASC");
    expect(planningJql("100", "5", 123)).toBe("filter = 100 AND sprint = 5 ORDER BY cf[123] ASC");
  });
});
