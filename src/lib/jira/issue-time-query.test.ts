import { QueryClient } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/issue-time.json";
import { issueTimeSummary } from "./issue-time";

const mock = vi.hoisted(() => { const reads: string[] = []; return { jira: vi.fn(), reads, cloudId: "site" }; });
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), jira: mock.jira, currentSite: Effect.sync(() => ({ cloudId: mock.cloudId })) }));
const { issueQuery, jiraKeys } = await import("./queries");
const { JiraApiError } = await import("./client");
const scope = { cloudId: "site", accountId: "me" };
let client: QueryClient;
const read = (key = "DEMO-1", account = scope) => client.fetchQuery({ ...issueQuery(key, account, client), retry: false });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mock.cloudId = "site";
  client.setQueryData(jiraKeys.site, { cloudId: "site" });
  client.setQueryData(jiraKeys.myself, { accountId: "me" });
  mock.reads.length = 0;
  mock.jira.mockReset().mockImplementation((path: string, schema: Schema.Decoder<unknown>) => Effect.suspend(() => { mock.reads.push(path); return Schema.decodeUnknownEffect(schema)(fixture); }));
});
afterEach(() => client.clear());

describe("Zeitwerte ueber den bestehenden Detail-GET", () => {
  it("dekodiert echte Sekunden/Nullwerte und Aggregate mit einem scoped fields=*all-Read", async () => {
    const issue = await read();
    expect(mock.jira).toHaveBeenCalledOnce();
    expect(mock.jira.mock.calls[0][0]).toBe("/issue/DEMO-1?fields=*all&expand=names,editmeta");
    const request = mock.jira.mock.calls[0][2];
    expect(request.scope.cloudId).toBe("site");
    expect(request.scope.isCurrent()).toBe(true);
    expect(issue.fields.timetracking?.originalEstimateSeconds).toBe(86400);
    expect(issueTimeSummary(issue.fields).map((row) => row.aggregate.text)).toEqual(["48 h", "5 h", "10 h"]);
    expect(issue.fields.worklog?.total).toBe(9);
    expect(issue.fields.worklog?.worklogs).toHaveLength(1);
  });
  it("akzeptiert null timetracking und fehlende/ungueltige Aggregate ohne Gesamtschaetzung", async () => {
    mock.jira.mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)({ ...fixture, fields: { ...fixture.fields, timetracking: null, aggregatetimeoriginalestimate: null, aggregatetimespent: "bad", aggregatetimeestimate: undefined } }));
    const issue = await read();
    const rows = issueTimeSummary(issue.fields);
    expect(rows.map((row) => row.own.text)).toEqual(["24 h", "2 h", "4 h"]);
    expect(rows.map((row) => row.aggregate.state)).toEqual(["missing", "invalid", "missing"]);
    expect(mock.jira).toHaveBeenCalledOnce();
  });
  it("laedt ein anderes Ticket eigenstaendig und uebernimmt keine alten Aggregate", async () => {
    await read();
    mock.jira.mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)({ ...fixture, key: "DEMO-2", fields: { ...fixture.fields, aggregatetimeoriginalestimate: null, aggregatetimespent: null, aggregatetimeestimate: null } }));
    expect(issueTimeSummary((await read("DEMO-2")).fields).every((row) => row.aggregate.state === "missing")).toBe(true);
    expect(issueTimeSummary(client.getQueryData<Awaited<ReturnType<typeof read>>>(jiraKeys.issueDetail("DEMO-1", scope))!.fields)[0].aggregate.text).toBe("48 h");
  });
  it("startet fuer ein unbestaetigtes anderes Konto keinen Read und nutzt dessen alten Cache nicht", async () => {
    await read();
    await expect(read("DEMO-1", { ...scope, accountId: "other" })).rejects.toMatchObject({ _tag: "JiraQueryScopeChanged" });
    expect(client.getQueryData(jiraKeys.issueDetail("DEMO-1", { ...scope, accountId: "other" }))).toBeUndefined();
    expect(mock.reads).toHaveLength(1);
  });
  it.each(["account", "site"])("verwirft bei %s-Wechsel die Antwort und stoppt den Request-Scope", async (kind) => {
    mock.jira.mockImplementation((_path: string, schema: Schema.Decoder<unknown>, init: { scope: { isCurrent: () => boolean } }) => Effect.gen(function* () {
      if (kind === "account") client.setQueryData(jiraKeys.myself, { accountId: "other" });
      else { mock.cloudId = "other-site"; client.setQueryData(jiraKeys.site, { cloudId: "other-site" }); }
      expect(init.scope.isCurrent()).toBe(false);
      return yield* Schema.decodeUnknownEffect(schema)(fixture);
    }));
    await expect(read()).rejects.toMatchObject({ _tag: "JiraQueryScopeChanged" });
    expect(client.getQueryData(jiraKeys.issueDetail("DEMO-1", scope))).toBeUndefined();
  });
  it("behaelt bei Readfehler nur den bekannten Cache und erfindet keine neuen Null-/Gesamtwerte", async () => {
    const original = await read();
    mock.jira.mockReturnValue(Effect.fail(new JiraApiError({ status: 403, body: "denied" })));
    await expect(read()).rejects.toMatchObject({ status: 403 });
    const stored = client.getQueryData<Awaited<ReturnType<typeof read>>>(jiraKeys.issueDetail("DEMO-1", scope));
    expect(stored).toBe(original);
    expect(client.getQueryState(jiraKeys.issueDetail("DEMO-1", scope))?.status).toBe("error");
    expect(issueTimeSummary(stored!.fields)[0].aggregate.text).toBe("48 h");
    await expect(read("DEMO-9")).rejects.toMatchObject({ status: 403 });
    expect(client.getQueryData(jiraKeys.issueDetail("DEMO-9", scope))).toBeUndefined();
  });
});
