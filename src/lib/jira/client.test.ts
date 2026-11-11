import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JIRA_READ_CONCURRENCY, JIRA_WRITE_CONCURRENCY } from "./request-policy";

const { http, invoke } = vi.hoisted(() => ({ http: vi.fn(), invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: http }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const session = { accessToken: "test-access", refreshToken: "test-refresh", expiresAt: 9e12, cloudId: "test-cloud", siteUrl: "https://jira.test", siteName: "Mock" };
const Result = Schema.Struct({ ok: Schema.Boolean });

beforeEach(async () => {
  vi.resetModules();
  await import("./client");
  vi.useFakeTimers();
  http.mockReset();
  invoke.mockReset();
  invoke.mockImplementation(async (command: string) => command === "session_get" ? JSON.stringify(session) : undefined);
});
afterEach(() => vi.useRealTimers());

describe("Jira transport request budgets", () => {
  it("bounds concurrent reads, reserves write capacity and loads the keychain once", async () => {
    const { jira, jiraSend } = await import("./client");
    let open = 0;
    let peak = 0;
    let writes = 0;
    http.mockImplementation(async (_url: string, init: RequestInit) => {
      open++;
      peak = Math.max(peak, open);
      if (init.method === "PUT") writes++;
      await new Promise((resolve) => setTimeout(resolve, 100));
      open--;
      return Response.json({ ok: true });
    });
    const reads = Promise.all(Array.from({ length: 30 }, (_, i) => Effect.runPromise(jira(`/read/${i}`, Result))));
    await vi.advanceTimersByTimeAsync(10);
    expect(open).toBe(JIRA_READ_CONCURRENCY);
    const commands = Promise.all(Array.from({ length: 5 }, (_, i) => Effect.runPromise(jiraSend(`/issue/X-${i}`, { method: "PUT", body: "{}" }))));
    await vi.advanceTimersByTimeAsync(10);
    expect(writes).toBe(JIRA_WRITE_CONCURRENCY);
    expect(peak).toBe(JIRA_READ_CONCURRENCY + JIRA_WRITE_CONCURRENCY);
    await vi.runAllTimersAsync();
    await Promise.all([reads, commands]);
    expect(invoke.mock.calls.filter(([command]) => command === "session_get")).toHaveLength(1);
  });

  it("honors Retry-After for reads and gates other requests during cooldown", async () => {
    const { jira } = await import("./client");
    http.mockResolvedValueOnce(new Response("slow down", { status: 429, headers: { "Retry-After": "2" } }));
    http.mockImplementation(async () => Response.json({ ok: true }));
    const first = Effect.runPromise(jira("/first", Result));
    await vi.advanceTimersByTimeAsync(1);
    const second = Effect.runPromise(jira("/second", Result));
    await vi.advanceTimersByTimeAsync(1998);
    expect(http).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    await expect(first).resolves.toEqual({ ok: true });
    await expect(second).resolves.toEqual({ ok: true });
    expect(http).toHaveBeenCalledTimes(3);
  });

  it("retries temporary read failures twice, but never duplicates writes", async () => {
    const { jira, jiraSend } = await import("./client");
    http.mockImplementation(async () => new Response("unavailable", { status: 503 }));
    const read = Effect.runPromise(jira("/read", Result)).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(await read).toMatchObject({ _tag: "JiraApiError", status: 503 });
    expect(http).toHaveBeenCalledTimes(3);
    http.mockClear();
    const write = Effect.runPromise(jiraSend("/issue/X-1/comment", { method: "POST", body: "{}" })).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(await write).toMatchObject({ _tag: "JiraApiError", status: 503 });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("aborts queued requests and cooldown without sending more HTTP requests", async () => {
    const { jira } = await import("./client");
    http.mockImplementation(async () => new Response("limit", { status: 429, headers: { "Retry-After": "60" } }));
    const controller = new AbortController();
    const reads = Array.from({ length: 20 }, () => Effect.runPromise(jira("/read", Result), { signal: controller.signal }).catch(() => "cancelled"));
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    const sent = http.mock.calls.length;
    await vi.runAllTimersAsync();
    expect(await Promise.all(reads)).toEqual(Array(20).fill("cancelled"));
    expect(sent).toBeLessThanOrEqual(JIRA_READ_CONCURRENCY);
    expect(http).toHaveBeenCalledTimes(sent);
  });

  it("allows background reads to opt out of transport retries without forwarding the policy to HTTP", async () => {
    const { jira } = await import("./client");
    http.mockResolvedValue(new Response("unavailable", { status: 503 }));
    const failed = Effect.runPromise(jira("/background", Result, { retry: false })).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(await failed).toMatchObject({ status: 503 });
    expect(http).toHaveBeenCalledTimes(1);
    expect(http.mock.calls[0][1]).not.toHaveProperty("retry");
  });

  it("reports a long cooldown immediately instead of hiding the error behind a long retry", async () => {
    const { jira } = await import("./client");
    http.mockResolvedValue(new Response("limit", { status: 429, headers: { "Retry-After": "120" } }));
    const failed = Effect.runPromise(jira("/read", Result)).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10);
    expect(await failed).toMatchObject({ status: 429 });
    await expect(Effect.runPromise(jira("/queued", Result))).rejects.toMatchObject({ status: 429 });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("does not retry schema or permission errors", async () => {
    const { jira } = await import("./client");
    http.mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
    await expect(Effect.runPromise(jira("/read", Result))).rejects.toMatchObject({ status: 403 });
    http.mockResolvedValueOnce(Response.json({ broken: true }));
    await expect(Effect.runPromise(jira("/read", Result))).rejects.toBeDefined();
    expect(http).toHaveBeenCalledTimes(2);
  });
});

describe("Jira image downloads", () => {
  it("asks for any content type, because Jira answers Accept: image/* with 406", async () => {
    const { jiraImage } = await import("./client");
    http.mockResolvedValueOnce(new Response("", { status: 404 }));
    await expect(Effect.runPromise(jiraImage("/attachment/content/1?redirect=false"))).rejects.toMatchObject({ status: 404 });
    expect(new Headers(http.mock.calls[0][1].headers).get("Accept")).toBe("*/*");
  });
});
