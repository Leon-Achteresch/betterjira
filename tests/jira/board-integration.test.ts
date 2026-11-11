import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createJiraMock } from "./mock-backend";
import { useJiraMock } from "./tauri-mock";

vi.mock("@tauri-apps/plugin-http", () => import("./tauri-mock"));
vi.mock("@tauri-apps/api/core", () => import("./tauri-mock"));
vi.mock("@tauri-apps/api/window", () => import("./tauri-mock"));

let client: QueryClient;
const board = { id: 2, type: "kanban" };
const setup = async (pageLimit?: number) => {
  const mock = useJiraMock(createJiraMock({
    issues: 5000, projects: ["PERF"], pageLimit,
    latency: { "board-config": { base: 300 }, fields: { base: 400 }, search: { base: 800 } },
  }));
  const { boardQuery } = await import("@/lib/jira/board-query");
  const { boardGroups } = await import("@/lib/jira/board");
  return { mock, options: boardQuery(client, board), boardGroups };
};

beforeAll(async () => {
  await import("@/lib/jira/board-query");
  await import("@/lib/jira/board");
}, 30_000);

beforeEach(() => {
  vi.useFakeTimers();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(() => { client.clear(); vi.useRealTimers(); });

describe("real board queries against the slow Jira backend", () => {
  it("publishes the first page after parallel metadata, then navigates from cache without requests", async () => {
    const { mock, options, boardGroups } = await setup();
    const start = Date.now();
    const loading = client.fetchInfiniteQuery(options);
    await vi.advanceTimersByTimeAsync(1300);
    const data = await loading;
    expect(mock.requests.find((request) => request.route === "search")?.startedAt).toBe(start + 400);
    expect(mock.requests.at(-1)?.endedAt).toBe(start + 1200);
    expect(boardGroups(data).flatMap((group) => group.columns.flatMap((column) => column.issues))).toHaveLength(100);
    expect(mock.stats()).toMatchObject({ total: 3, maxInFlight: 2, byRoute: { "board-config": 1, fields: 1, search: 1 } });
    await client.fetchInfiniteQuery(options);
    expect(mock.stats().total).toBe(3);
  });

  it("loads every one of 5,000 issues without reloading metadata or losing cursor pages", async () => {
    const { mock, options, boardGroups } = await setup();
    const loading = client.fetchInfiniteQuery({ ...options, pages: 50 });
    await vi.advanceTimersByTimeAsync(41_000);
    const data = await loading;
    const cards = boardGroups(data).flatMap((group) => group.columns.flatMap((column) => column.issues));
    expect(cards).toHaveLength(5000);
    expect(new Set(cards.map((card) => card.key)).size).toBe(5000);
    expect(mock.stats().byRoute).toMatchObject({ fields: 1, "board-config": 1, search: 50 });
    expect(mock.stats().maxInFlight).toBeLessThanOrEqual(6);
  });

  it("reconciles a burst of changes in a single small response while preserving loaded pages", async () => {
    const { mock, options } = await setup();
    const { scheduleBoardReconcile } = await import("@/lib/jira/board-cache");
    const observer = new InfiniteQueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.advanceTimersByTimeAsync(1300);
    const more = observer.fetchNextPage();
    await vi.advanceTimersByTimeAsync(810);
    await more;
    const before = observer.getCurrentResult().data!.pages.flatMap((page) => page.issues);
    mock.resetStats();
    const changed = before.slice(0, 10);
    for (const issue of changed) {
      mock.jira.editIssue(issue.key, { fields: { summary: `Updated ${issue.key}` } });
      scheduleBoardReconcile(client, issue.key);
    }
    await vi.advanceTimersByTimeAsync(1000);
    const after = observer.getCurrentResult().data!.pages.flatMap((page) => page.issues);
    expect(after).toHaveLength(200);
    expect(after.find((issue) => issue.key === changed[0].key)?.fields.summary).toBe(`Updated ${changed[0].key}`);
    expect(mock.stats()).toMatchObject({ total: 1, items: 10, byRoute: { search: 1 } });
    expect(new URL(mock.requests[0].path, "https://jira.test").searchParams.get("reconcileIssues")?.split(","))
      .toEqual(changed.map((issue) => issue.id));
    unsubscribe();
  });

  it("follows smaller server pages during reconciliation without removing later changed issues", async () => {
    const { mock, options } = await setup(3);
    const { reconcileBoards } = await import("@/lib/jira/board-cache");
    const observer = new InfiniteQueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.advanceTimersByTimeAsync(1300);
    const loaded = observer.getCurrentResult().data!.pages[0].issues;
    const loadedKeys = new Set(loaded.map((issue) => issue.key));
    const keys = [...loaded.map((issue) => issue.key), ...mock.data.issues.filter((issue) => !loadedKeys.has(issue.key)).slice(0, 7).map((issue) => issue.key)];
    mock.resetStats();
    const refreshing = reconcileBoards(client, keys);
    await vi.advanceTimersByTimeAsync(3300);
    await refreshing;
    const after = observer.getCurrentResult().data!.pages.flatMap((page) => page.issues);
    expect(after).toHaveLength(10);
    expect(new Set(after.map((issue) => issue.key))).toEqual(new Set(keys));
    expect(mock.stats()).toMatchObject({ total: 4, items: 10 });
    unsubscribe();
  });

  it("updates active search pages with a filtered request and leaves boards alone for comments", async () => {
    const { mock } = await setup();
    const { issueSearchQuery } = await import("@/lib/jira/search-query");
    const { scheduleBoardReconcile } = await import("@/lib/jira/board-cache");
    const { invalidateIssueChange } = await import("@/lib/jira/mutation-cache");
    const observer = new InfiniteQueryObserver(client, issueSearchQuery("project = PERF ORDER BY Rank ASC", ["summary", "status"], 100));
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.advanceTimersByTimeAsync(810);
    const more = observer.fetchNextPage();
    await vi.advanceTimersByTimeAsync(810);
    await more;
    const issue = observer.getCurrentResult().data!.pages[0].issues[0];
    mock.jira.editIssue(issue.key, { fields: { summary: "Updated search" } });
    mock.resetStats();
    scheduleBoardReconcile(client, issue.key);
    await vi.advanceTimersByTimeAsync(1000);
    expect(observer.getCurrentResult().data!.pages.flatMap((page) => page.issues)).toHaveLength(200);
    expect(observer.getCurrentResult().data!.pages[0].issues[0].fields.summary).toBe("Updated search");
    expect(mock.stats()).toMatchObject({ total: 1, items: 1 });
    mock.resetStats();
    invalidateIssueChange(client, issue.key, false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(mock.stats().total).toBe(0);
    unsubscribe();
  });

  it("retains cached cards when a later page fails and continues from the same cursor on retry", async () => {
    const { mock, options } = await setup();
    const observer = new InfiniteQueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.advanceTimersByTimeAsync(1300);
    mock.addFault({ route: "search", status: 403, times: 1 });
    const failing = observer.fetchNextPage();
    await vi.advanceTimersByTimeAsync(810);
    await failing;
    expect(observer.getCurrentResult().isFetchNextPageError).toBe(true);
    expect(observer.getCurrentResult().data?.pages).toHaveLength(1);
    const retry = observer.fetchNextPage();
    await vi.advanceTimersByTimeAsync(810);
    await retry;
    expect(observer.getCurrentResult().data?.pages).toHaveLength(2);
    expect(observer.getCurrentResult().isError).toBe(false);
    unsubscribe();
  });

  it("honors a slow 429 response and recovers without duplicating the initial page", async () => {
    const { mock, options } = await setup();
    mock.addFault({ route: "search", status: 429, retryAfter: 2, times: 1 });
    const loading = client.fetchInfiniteQuery(options);
    await vi.advanceTimersByTimeAsync(4500);
    const data = await loading;
    const search = mock.requests.filter((request) => request.route === "search");
    expect(search).toHaveLength(2);
    expect(search[1].startedAt - search[0].endedAt!).toBeGreaterThanOrEqual(2000);
    expect(data.pages).toHaveLength(1);
    expect(data.pages[0].issues).toHaveLength(100);
  });
});
