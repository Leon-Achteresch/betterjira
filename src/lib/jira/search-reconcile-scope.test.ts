import { QueryClient, QueryObserver, InfiniteQueryObserver } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { SearchData } from "./search-loading";
const mock = vi.hoisted(() => ({ jira: vi.fn(), changeAccount: false }));
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), jira: mock.jira, currentSite: Effect.succeed({ cloudId: "site" }) }));
const { reconcileSearches } = await import("./board-cache");
const { issueSearchQuery } = await import("./search-query");
const { jiraKeys } = await import("./keys");
const scope = { cloudId: "site", accountId: "me" };
const data: SearchData = { pages: [{ issues: [{ id: "1", key: "DEMO-1", fields: { summary: "alt" } }], isLast: true }], pageParams: [undefined] };
let client: QueryClient;
const unsubscribes: (() => void)[] = [];
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(jiraKeys.site, { cloudId: "site" }); client.setQueryData(jiraKeys.myself, { accountId: "me" }); mock.changeAccount = false;
  mock.jira.mockReset().mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Effect.suspend(() => {
    if (mock.changeAccount) client.setQueryData(jiraKeys.myself, { accountId: "other" });
    return Schema.decodeUnknownEffect(schema)({ issues: [{ id: "1", key: "DEMO-1", fields: { summary: "neu" } }], isLast: true });
  }));
});
afterEach(() => { unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe()); client.clear(); });
const active = (accountId: string) => {
  const queryKey = jiraKeys.searchScoped("project = DEMO", ["summary"], 50, { ...scope, accountId });
  client.setQueryData(queryKey, data);
  const observer = new QueryObserver(client, { queryKey, queryFn: async () => data }); unsubscribes.push(observer.subscribe(() => undefined)); return queryKey;
};
describe("vorhandene Suchabstimmung mit Kontoscope", () => {
  it("aktualisiert nur den aktiven Kontoscope und reicht ihn an den Request", async () => {
    const own = active("me"); const other = active("other");
    await reconcileSearches(client, ["DEMO-1"]);
    expect(client.getQueryData<SearchData>(own)?.pages[0].issues[0].fields.summary).toBe("neu");
    expect(client.getQueryData(other)).toBe(data);
    expect(mock.jira).toHaveBeenCalledOnce(); expect(mock.jira.mock.calls[0][2].scope.cloudId).toBe("site");
  });
  it("verwirft eine Abstimmungsantwort nach Kontowechsel", async () => {
    const own = active("me"); mock.changeAccount = true; await reconcileSearches(client, ["DEMO-1"]);
    expect(client.getQueryData(own)).toBe(data);
  });
  it("zeigt PreviousData nur innerhalb desselben Kontos und sperrt unbekannten Scope", async () => {
    const options = issueSearchQuery("project = DEMO", ["summary"], 50, { client, scope });
    client.setQueryData(options.queryKey, data);
    const observer = new InfiniteQueryObserver(client, options); unsubscribes.push(observer.subscribe(() => undefined));
    observer.setOptions(issueSearchQuery("project = OTHER", ["summary"], 50, { client, scope }));
    expect(observer.getCurrentResult().isPlaceholderData).toBe(true);
    observer.setOptions({ ...issueSearchQuery("project = OTHER", ["summary"], 50, { client, scope: { ...scope, accountId: "other" } }), enabled: false });
    expect(observer.getCurrentResult().data).toBeUndefined();
    observer.setOptions({ ...issueSearchQuery("project = OTHER", ["summary"], 50, { client, scope: undefined }), enabled: false });
    expect(observer.getCurrentResult().data).toBeUndefined();
  });
});
