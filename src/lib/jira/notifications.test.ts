import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect, Schema } from "effect";
import { fetchActivity } from "./notifications";

const mock = vi.hoisted(() => ({ respond: vi.fn<(url: URL) => unknown>(), paths: [] as string[] }));
vi.mock("./client", () => ({
  jira: (path: string, schema: Schema.Decoder<unknown>) => Effect.suspend(() => {
    mock.paths.push(path);
    return Schema.decodeUnknownEffect(schema)(mock.respond(new URL(path, "https://jira.test")));
  }),
}));

const now = Date.now();
const actor = { accountId: "other", displayName: "Sam", avatarUrls: { "48x48": "" } };
const comment = (id: string, created = now) => ({ id, created: new Date(created).toISOString(), author: actor, body: "Kommentar" });
const issue = (key: string) => ({
  key,
  fields: { summary: key, created: new Date(0).toISOString(), reporter: { ...actor, accountId: "me" }, comment: { comments: [comment(key)] } },
});

beforeEach(() => {
  mock.paths.length = 0;
  mock.respond.mockReset();
});

describe("fetchActivity", () => {
  it("loads every search page before considering the poll complete", async () => {
    mock.respond.mockImplementation((url) => url.searchParams.get("maxResults") === "1"
      ? { issues: [{ id: "1" }] }
      : url.searchParams.has("nextPageToken")
        ? { issues: [issue("X-2")], isLast: true }
        : { issues: [issue("X-1")], nextPageToken: "second", isLast: false });
    expect((await Effect.runPromise(fetchActivity("me", now - 1000))).map((item) => item.issueKey)).toEqual(["X-1", "X-2"]);
  });

  it("rejects a repeated search token instead of looping or dropping activity", async () => {
    mock.respond.mockImplementation((url) => url.searchParams.get("maxResults") === "1" ? { issues: [{ id: "1" }] }
      : { issues: [issue("X-1")], nextPageToken: "same", isLast: false });
    await expect(Effect.runPromise(fetchActivity("me", now))).rejects.toMatchObject({ _tag: "ActivityPagingError" });
  });

  it("loads recent comments omitted by the embedded comment limit", async () => {
    const item = issue("X-1");
    mock.respond.mockImplementation((url) => {
      if (url.pathname.endsWith("/comment")) return { startAt: Number(url.searchParams.get("startAt")), total: 2, comments: [comment("old", 0), comment("new")] };
      if (url.searchParams.get("maxResults") === "1") return { issues: [{ id: "1" }] };
      return { issues: [{ ...item, fields: { ...item.fields, comment: { total: 2, comments: [comment("old", 0)] } } }] };
    });
    const items = await Effect.runPromise(fetchActivity("me", now));
    expect(items.map((item) => item.id)).toEqual(["c:new"]);
    expect(items[0].body).toBe("Kommentar");
  });

  it("does not let malformed ADF break the entire poll", async () => {
    const item = issue("X-1");
    mock.respond.mockImplementation((url) => url.searchParams.get("maxResults") === "1" ? { issues: [{ id: "1" }] } : {
      issues: [{ ...item, fields: { ...item.fields, comment: { comments: [{ ...comment("broken"), body: { type: "doc", content: "invalid" } }, comment("valid")] } } }],
    });
    expect((await Effect.runPromise(fetchActivity("me", now))).map((item) => item.id)).toEqual(["c:broken", "c:valid"]);
  });
});

describe("activity coverage", () => {
  it("fills recent history windows even when Jira caps page size", async () => {
    const histories = Array.from({ length: 63 }, (_, id) => ({ id: String(id), created: new Date(now).toISOString(), author: actor, items: [{ field: "status", fromString: "Open", toString: "Done" }] }));
    mock.respond.mockImplementation((url) => {
      if (url.pathname.endsWith("/changelog")) {
        const startAt = Number(url.searchParams.get("startAt"));
        const max = Math.min(7, Number(url.searchParams.get("maxResults")));
        return { startAt, total: histories.length, values: histories.slice(startAt, startAt + max) };
      }
      if (url.searchParams.get("maxResults") === "1") return { issues: [{ id: "1" }] };
      return { issues: [{ ...issue("X-1"), changelog: { total: histories.length, histories: histories.slice(-10) } }] };
    });
    const items = await Effect.runPromise(fetchActivity("me", now));
    expect(new Set(items.filter((item) => item.id.startsWith("h:")).map((item) => item.id)).size).toBe(63);
  });

  it("rejects an incomplete comment page without claiming success", async () => {
    const item = issue("X-1");
    mock.respond.mockImplementation((url) => {
      if (url.pathname.endsWith("/comment")) return { startAt: 0, total: 2, comments: [] };
      if (url.searchParams.get("maxResults") === "1") return { issues: [{ id: "1" }] };
      return { issues: [{ ...item, fields: { ...item.fields, comment: { total: 2, comments: [comment("old", 0)] } } }] };
    });
    await expect(Effect.runPromise(fetchActivity("me", now))).rejects.toMatchObject({ _tag: "ActivityPagingError" });
  });

  it("filters own activity, old events and noise while preserving direct mentions", async () => {
    const item = issue("X-1");
    const mention = { type: "doc", content: [{ type: "paragraph", content: [{ type: "mention", attrs: { id: "me", text: "@Me" } }] }] };
    mock.respond.mockImplementation((url) => url.searchParams.get("maxResults") === "1" ? { issues: [{ id: "1" }] } : {
      issues: [{ ...item, fields: { ...item.fields, reporter: null, comment: { comments: [comment("old", 0), { ...comment("mine"), author: { ...actor, accountId: "me" } }, { ...comment("mention"), body: mention }] } }, changelog: { histories: [{ id: "noise", created: new Date(now).toISOString(), author: actor, items: [{ field: "Rank", toString: null }] }] } }],
    });
    expect(await Effect.runPromise(fetchActivity("me", now))).toMatchObject([{ id: "c:mention", kind: "direct", body: "@Me" }]);
  });
});
