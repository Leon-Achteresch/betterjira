import { InfiniteQueryObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardQuery } from "./board-query";
import { boardGroups, type BoardData, type BoardIssue } from "./board";
import { jiraKeys } from "./keys";
import { patchBoardIssue, reconcileBoards, rollbackBoardPatches, scheduleBoardReconcile } from "./board-cache";
import { deduplicateMutation } from "./deduplicate-mutation";
import { issueSearchQuery } from "./search-query";
import { invalidateIssueChange } from "./mutation-cache";

const { jira, jiraAgile } = vi.hoisted(() => ({ jira: vi.fn(), jiraAgile: vi.fn() }));
vi.mock("./client", () => ({ jira, jiraAgile }));

const board = { id: 1, type: "kanban" };
const status = (id = "1") => ({ id, name: id === "1" ? "Offen" : "Erledigt", statusCategory: { key: id === "1" ? "new" : "done", colorName: "blue" } });
const issue = (i: number): BoardIssue => ({ id: String(i), key: `TEST-${i}`, fields: { summary: `Issue ${i}`, status: status(), assignee: null, created: "2026-10-01T00:00:00Z", issuetype: { name: "Task" } } });
const config = { filter: { id: "100" }, columnConfig: { columns: ["1", "2"].map((id) => ({ name: status(id).name, statuses: [{ id }] })) } };
const requests: { path: string; start: number }[] = [];
let issues: BoardIssue[];
let client: QueryClient;

const respond = (path: string, schema: Schema.Decoder<unknown>) => Effect.gen(function* () {
  requests.push({ path, start: Date.now() });
  if (path.includes("/configuration")) {
    yield* Effect.sleep(300);
    return yield* Schema.decodeUnknownEffect(schema)(config);
  }
  if (path === "/field") {
    yield* Effect.sleep(400);
    return yield* Schema.decodeUnknownEffect(schema)([]);
  }
  const url = new URL(path, "https://jira.test");
  const jql = url.searchParams.get("jql") ?? "";
  const keys = [...jql.matchAll(/"(TEST-\d+)"/g)].map((match) => match[1]);
  const found = keys.length ? issues.filter((issue) => keys.includes(issue.key)) : issues;
  const offset = Number(url.searchParams.get("nextPageToken") ?? "0");
  const size = Number(url.searchParams.get("maxResults") ?? "100");
  yield* Effect.sleep(800);
  return yield* Schema.decodeUnknownEffect(schema)({ issues: found.slice(offset, offset + size), isLast: offset + size >= found.length, nextPageToken: offset + size < found.length ? String(offset + size) : undefined });
});

const firstPage = async () => {
  const result = client.fetchInfiniteQuery(boardQuery(client, board));
  await vi.advanceTimersByTimeAsync(1300);
  return result;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  issues = Array.from({ length: 5000 }, (_, index) => issue(index + 1));
  requests.length = 0;
  jira.mockReset().mockImplementation(respond);
  jiraAgile.mockReset().mockImplementation(respond);
});
afterEach(() => { client.clear(); vi.useRealTimers(); });

describe("large-board query budgets", () => {
  it("starts metadata in parallel and renders page one without waiting for 5,000 issues", async () => {
    const data = await firstPage();
    expect(requests.map(({ start }) => start)).toEqual([0, 0, 400]);
    expect(data.pages).toHaveLength(1);
    expect(boardGroups(data)[0].columns[0].issues).toHaveLength(100);
    expect(requests).toHaveLength(3);
  });

  it("deduplicates competing observers and caches metadata across boards and refreshes", async () => {
    const first = client.fetchInfiniteQuery(boardQuery(client, board));
    const second = client.fetchInfiniteQuery(boardQuery(client, board));
    await vi.advanceTimersByTimeAsync(1300);
    expect(await first).toBe(await second);
    const warm = await client.fetchInfiniteQuery(boardQuery(client, board));
    expect(warm.pages).toHaveLength(1);
    expect(requests).toHaveLength(3);
    const other = client.fetchInfiniteQuery(boardQuery(client, { id: 2, type: "kanban" }));
    await vi.advanceTimersByTimeAsync(1200);
    await other;
    expect(requests.filter(({ path }) => path === "/field")).toHaveLength(1);
  });

  it("loads all 50 pages with cursor pagination and keeps every issue exactly once", async () => {
    const observer = new InfiniteQueryObserver(client, boardQuery(client, board));
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.advanceTimersByTimeAsync(1300);
    for (let page = 1; page < 50; page++) {
      const next = observer.fetchNextPage();
      await vi.advanceTimersByTimeAsync(810);
      await next;
    }
    const result = observer.getCurrentResult();
    const keys = result.data?.pages.flatMap((page) => page.issues.map((issue) => issue.key)) ?? [];
    expect(keys).toHaveLength(5000);
    expect(new Set(keys).size).toBe(5000);
    expect(result.hasNextPage).toBe(false);
    expect(requests.filter(({ path }) => path.includes("/search/jql"))).toHaveLength(50);
    expect(requests.filter(({ path }) => path.includes("/configuration"))).toHaveLength(1);
    expect(requests.filter(({ path }) => path === "/field")).toHaveLength(1);
    unsubscribe();
  });

  it("reconciles ten rapid changes with one filtered request, without replaying loaded pages", async () => {
    const observer = new InfiniteQueryObserver(client, boardQuery(client, board));
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.advanceTimersByTimeAsync(1300);
    for (let page = 0; page < 2; page++) {
      const next = observer.fetchNextPage();
      await vi.advanceTimersByTimeAsync(810);
      await next;
    }
    requests.length = 0;
    for (let i = 1; i <= 10; i++) {
      issues[i - 1] = { ...issues[i - 1], fields: { ...issues[i - 1].fields, summary: `Changed ${i}` } };
      scheduleBoardReconcile(client, `TEST-${i}`);
    }
    await vi.advanceTimersByTimeAsync(1000);
    expect(requests).toHaveLength(1);
    const data = client.getQueryData<BoardData>(jiraKeys.board(1));
    expect(data?.pages).toHaveLength(3);
    expect(data?.pages[0].issues[0].fields.summary).toBe("Changed 1");
    expect(data?.pages.flatMap((page) => page.issues)).toHaveLength(300);
    expect(client.getQueryState(jiraKeys.board(1))?.isInvalidated).toBe(false);
    client.getQueryCache().onFocus();
    await vi.advanceTimersByTimeAsync(1);
    expect(requests).toHaveLength(1);
    unsubscribe();
  });

  it("rolls back only failed fields, preserving successful edits of other tickets and fields", async () => {
    await firstPage();
    const patches = patchBoardIssue(client, "TEST-1", { summary: "Fail" }, status("2"));
    patchBoardIssue(client, "TEST-2", { summary: "Keep" });
    patchBoardIssue(client, "TEST-1", { labels: ["Keep"] });
    rollbackBoardPatches(client, patches);
    const cards = client.getQueryData<BoardData>(jiraKeys.board(1))!.pages[0].issues;
    expect(cards[0].fields.summary).toBe("Issue 1");
    expect(cards[0].fields.status.id).toBe("1");
    expect(cards[0].fields.labels).toEqual(["Keep"]);
    expect(cards[1].fields.summary).toBe("Keep");
  });

  it("does not overwrite a newer optimistic change with an older server response", async () => {
    const observer = new InfiniteQueryObserver(client, boardQuery(client, board));
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.advanceTimersByTimeAsync(1300);
    const refresh = reconcileBoards(client, ["TEST-1"]);
    await vi.advanceTimersByTimeAsync(100);
    patchBoardIssue(client, "TEST-1", { summary: "Newer draft" });
    await vi.advanceTimersByTimeAsync(800);
    await refresh;
    expect(client.getQueryData<BoardData>(jiraKeys.board(1))?.pages[0].issues[0].fields.summary).toBe("Newer draft");
    unsubscribe();
  });

  it("normalizes field selection so column reordering does not make a new search request", () => {
    expect(issueSearchQuery("project = TEST", ["status", "summary", "summary"]).queryKey)
      .toEqual(issueSearchQuery("project = TEST", ["summary", "status"]).queryKey);
  });

  it("batches count and command-palette refreshes across a burst of edits", async () => {
    const count = vi.fn(async () => ({ count: 5000 }));
    const work = vi.fn(async () => ({ issues: [] }));
    const countObserver = new QueryObserver(client, { queryKey: jiraKeys.issueCount("project = TEST"), queryFn: count });
    const workObserver = new QueryObserver(client, { queryKey: jiraKeys.myWork, queryFn: work });
    const unsubscribeCount = countObserver.subscribe(() => undefined);
    const unsubscribeWork = workObserver.subscribe(() => undefined);
    await vi.advanceTimersByTimeAsync(1);
    count.mockClear();
    work.mockClear();
    for (let i = 1; i <= 10; i++) invalidateIssueChange(client, `TEST-${i}`, true);
    expect(count).not.toHaveBeenCalled();
    expect(work).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(count).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledTimes(1);
    unsubscribeCount();
    unsubscribeWork();
  });

  it("coalesces identical pending writes and allows an intentional later repeat", async () => {
    const write = vi.fn(async () => { await new Promise((resolve) => setTimeout(resolve, 500)); });
    const first = deduplicateMutation(client, "comment:TEST-1:hello", write);
    const second = deduplicateMutation(client, "comment:TEST-1:hello", write);
    await vi.advanceTimersByTimeAsync(501);
    await Promise.all([first, second]);
    expect(write).toHaveBeenCalledTimes(1);
    const third = deduplicateMutation(client, "comment:TEST-1:hello", write);
    await vi.advanceTimersByTimeAsync(501);
    await third;
    expect(write).toHaveBeenCalledTimes(2);
  });
});
