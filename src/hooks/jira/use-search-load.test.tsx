import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchData } from "@/lib/jira/search-loading";

const mock = vi.hoisted(() => { const pages = new Map<string, unknown>(); const state: { current: unknown } = { current: null }; const latest: { current: unknown } = { current: null }; return { pages, state, latest, jira: vi.fn(), clipboard: vi.fn(), accountId: "me", delay: 0, fail: "", requests: [] as string[], interrupted: vi.fn() }; });
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: <T,>(initial: T | (() => T)) => {
    const state = actual.useState(initial); const value = state[0];
    if (typeof value === "object" && value !== null && "token" in value && "progress" in value) {
      const current = mock.state.current ?? value; mock.state.current = current;
      return [current, (next: unknown) => { mock.state.current = typeof next === "function" ? next(mock.state.current ?? current) : next; }];
    }
    return state;
  } };
});
vi.mock("../use-latest-ref", () => ({ useLatestRef: (value: unknown) => { mock.latest.current = value; return mock.latest; } }));
vi.mock("@/lib/clipboard", () => ({ copyToClipboard: mock.clipboard }));
vi.mock("@/lib/jira/client", async (original) => ({ ...await original<typeof import("@/lib/jira/client")>(), jira: mock.jira, currentSite: Effect.succeed({ cloudId: "site" }) }));
vi.mock("@/lib/jira/queries", async (original) => ({ ...await original<typeof import("@/lib/jira/queries")>(), useJiraSite: () => ({ isSuccess: true, data: { cloudId: "site" } }), useJiraMyself: () => ({ isSuccess: true, data: { accountId: mock.accountId } }) }));
const { useIssueSearch } = await import("./use-issue-search");
const { useSearchLoad } = await import("./use-search-load");
const { issueSearchQuery } = await import("@/lib/jira/search-query");
const { jiraKeys } = await import("@/lib/jira/keys");
const { JiraApiError } = await import("@/lib/jira/client");
const scope = { cloudId: "site", accountId: "me" };
const fields = ["summary"];
const page = (ids: string[], next?: string, isLast = !next) => ({ issues: ids.map((id) => ({ id, key: `DEMO-${id}`, fields: { summary: id } })), nextPageToken: next, isLast });
let client: QueryClient;
type Model = ReturnType<typeof useSearchLoad>;
function Harness({ context, jql, expose }: { context: string; jql: string; expose: (value: Model) => void }) { const search = useIssueSearch(jql, fields); expose(useSearchLoad(search, context, !search.isPlaceholderData && !!search.data)); return null; }
const mount = (context = "table", jql = "project = DEMO") => {
  let model: Model | undefined;
  renderToStaticMarkup(<QueryClientProvider client={client}><Harness context={context} jql={jql} expose={(value) => { model = value; }} /></QueryClientProvider>);
  if (!model) throw new Error("missing model"); return model;
};
const seed = () => client.fetchInfiniteQuery(issueSearchQuery("project = DEMO", fields, 50, { client, scope }));
const done = () => vi.waitFor(() => expect(client.isFetching()).toBe(0));
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, refetchOnMount: false, gcTime: Infinity, staleTime: Infinity } } });
  mock.state.current = null; mock.latest.current = null; mock.accountId = "me"; mock.delay = 0; mock.fail = ""; mock.requests.length = 0; mock.interrupted.mockReset(); mock.clipboard.mockReset(); mock.pages.clear();
  client.setQueryData(jiraKeys.site, { cloudId: "site" }); client.setQueryData(jiraKeys.myself, { accountId: "me" });
  mock.pages.set("", page(["1"], "a")); mock.pages.set("a", page(["1", "2"], "b")); mock.pages.set("b", page(["3"]));
  mock.jira.mockReset().mockImplementation((path: string, schema: Schema.Decoder<unknown>) => Effect.gen(function* () {
    const token = new URL(path, "https://jira.test").searchParams.get("nextPageToken") ?? "";
    mock.requests.push(token);
    if (mock.delay) yield* Effect.sleep(mock.delay);
    if (mock.fail === token && token) return yield* new JiraApiError({ status: 403, body: "denied" });
    return yield* Schema.decodeUnknownEffect(schema)(mock.pages.get(token));
  }).pipe(Effect.onInterrupt(() => Effect.sync(() => mock.interrupted()))));
});
afterEach(() => client.clear());

describe("Sammelladen mit echten InfiniteQuery-Seiten", () => {
  it("startet nur bewusst, sperrt Doppelstart und kopiert niemals automatisch", async () => {
    await seed(); const model = mount(); expect(mock.requests).toEqual([""]);
    model.start(); model.start(); await done();
    expect(mock.requests).toEqual(["", "a", "b"]);
    expect(mount()).toMatchObject({ loaded: 3, duplicates: 1, pages: 2 });
    expect(mount().message).toContain("keine nächste Seite"); expect(mock.clipboard).not.toHaveBeenCalled();
  });
  it("haelt bei 403 Teilergebnisse und Cursor fuer bewussten spaeteren Versuch", async () => {
    await seed(); mock.fail = "b"; mount().start(); await done();
    expect(mount().loaded).toBe(2); expect(mount().message).toContain("nicht geladen"); expect(mock.requests).toEqual(["", "a", "b"]);
    mock.fail = ""; mount().start(); await done(); expect(mount().loaded).toBe(3); expect(mock.requests).toEqual(["", "a", "b", "b"]);
  });
  it("bricht in-flight Read ab und haengt keine spaete Seite an", async () => {
    await seed(); mock.delay = 500; const model = mount(); model.start();
    await vi.waitFor(() => expect(mock.requests).toContain("a")); model.stop(); await done();
    expect(mount().loaded).toBe(1); expect(mount().message).toContain("Abgebrochen"); expect(mock.interrupted).toHaveBeenCalled();
  });
  it.each(["context", "account", "jql"])("uebernimmt nach %s-Wechsel keine fremden Treffer", async (kind) => {
    await seed(); mock.delay = 50; mount().start(); await vi.waitFor(() => expect(mock.requests).toContain("a"));
    if (kind === "account") { mock.accountId = "other"; client.setQueryData(jiraKeys.myself, { accountId: "other" }); }
    mount(kind === "context" ? "new" : "table", kind === "jql" ? "project = OTHER" : "project = DEMO"); await done();
    expect(mock.requests).not.toContain("b"); expect(mock.clipboard).not.toHaveBeenCalled();
    if (kind === "account") expect(client.getQueryData(jiraKeys.searchScoped("project = DEMO", fields, 50, { ...scope, accountId: "other" }))).toBeUndefined();
  });
  it("kennzeichnet Cursorzyklen statt sie still als alle Treffer auszugeben", async () => {
    mock.pages.set("a", page(["2"], "a")); await seed(); mount().start(); await done(); expect(mount().message).toContain("keine verwendbare Fortsetzung"); expect(mock.requests).toEqual(["", "a"]);
  });
  it("verwirft zu grosse Serverseiten, ohne das Limit zu umgehen", async () => {
    mock.pages.set("a", page(Array.from({ length: 51 }, (_, i) => String(i)))); await seed(); mount().start(); await done();
    expect(mount().loaded).toBe(1); expect(mount().message).toContain("nicht geladen");
  });
  it("behält Scoped-Cache und Sortierung getrennt", async () => {
    await seed(); const original = client.getQueryData<SearchData>(jiraKeys.searchScoped("project = DEMO", fields, 50, scope));
    expect(client.getQueryData(jiraKeys.searchScoped("project = DEMO ORDER BY updated DESC", fields, 50, scope))).toBeUndefined();
    expect(client.getQueryData(jiraKeys.searchScoped("project = DEMO", fields, 50, { ...scope, cloudId: "other-site" }))).toBeUndefined();
    expect(original?.pages[0].issues[0].key).toBe("DEMO-1");
  });
});
