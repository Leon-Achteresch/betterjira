import { QueryClient } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/creation-hints.json";
const mock = vi.hoisted(() => ({ jira: vi.fn() }));
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), jira: mock.jira, currentSite: Effect.succeed({ cloudId: "site" }) }));
const { creationHintRequest, creationHintRows, creationHintsQuery } = await import("./creation-hints");
const { jiraKeys } = await import("./keys");
const { JiraApiError } = await import("./client");
const project = { id: "101", key: "DEMO", name: "Demo" }; const scope = { cloudId: "site", accountId: "me" };
const request = creationHintRequest(project, "Gateway meldet Fehler")!;
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient(); client.setQueryData(jiraKeys.site, { cloudId: "site" }); client.setQueryData(jiraKeys.myself, { accountId: "me" });
  mock.jira.mockReset().mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)(fixture));
});
afterEach(() => client.clear());
const read = () => client.fetchQuery(creationHintsQuery(client, scope, request, "owner", 0));
describe("begrenzte Jira-Titelsuche aus dem Erstellkontext", () => {
  it.each(["", "UI ++", "x".repeat(256)])("liest fuer unpassenden Titel %s keine globale Ersatzsuche", async (summary) => {
    const invalid = creationHintRequest(project, summary); expect(invalid).toBeUndefined();
    await expect(client.fetchQuery(creationHintsQuery(client, scope, invalid, "owner", 0))).rejects.toMatchObject({ _tag: "CreationHintsUnavailable" }); expect(mock.jira).not.toHaveBeenCalled();
  });
  it("braucht ein bestaetigtes Zielprojekt", () => { expect(creationHintRequest(undefined, "Gateway Fehler")).toBeUndefined(); expect(creationHintRequest({ id: "", key: "" }, "Gateway Fehler")).toBeUndefined(); });
  it("begrenzt und erklaert Titelwoerter statt JQL/Lucene-Syntax aus der Eingabe auszufuehren", () => {
    const value = creationHintRequest(project, 'Gateway GATEWAY Fehler ") OR project = OTHER AND rest next seventh eighth café cafe\u0301');
    expect(value?.terms).toEqual(["GATEWAY", "Fehler", "project", "OTHER", "AND"]);
    expect(value?.jql).toBe('project = "101" AND (summary ~ "GATEWAY*" OR summary ~ "Fehler*" OR summary ~ "project*" OR summary ~ "OTHER*" OR summary ~ "AND*") ORDER BY updated DESC');
    expect(creationHintRequest(project, "café cafe\u0301")?.terms).toEqual(["café"]);
  });
  it("verwendet echten vorhandenen SearchPage-/scoped GET-Vertrag ohne Cursor oder Zusatzseiten", async () => {
    const page = await read(); expect(page.issues).toHaveLength(6); expect(mock.jira).toHaveBeenCalledTimes(1);
    const [path, , options] = mock.jira.mock.calls[0]; const params = new URL(path, "https://jira.test").searchParams;
    expect(path.startsWith("/search/jql?")).toBe(true); expect(params.get("jql")).toBe(request.jql); expect(params.get("maxResults")).toBe("10");
    expect(params.get("fields")).toBe("summary,project,status,issuetype"); expect(params.has("nextPageToken")).toBe(false); expect(options.scope.cloudId).toBe("site"); expect(options.method).toBeUndefined();
  });
  it("zeigt nur bestaetigte Zieltreffer und dedupliziert ohne falschen Gesamtbestand", () => {
    const result = creationHintRows(fixture, project);
    expect(result).toMatchObject({ returned: 6, omitted: 2, duplicates: 1, coverage: "limited" });
    expect(result.rows.map((row) => row.key)).toEqual(["DEMO-1", "DEMO-2", "DEMO-5"]);
    expect(result.rows[1].status).toBe("Erledigt"); expect(result.rows[2].status).toBe("Status nicht geliefert");
  });
  it.each(["id", "key", "summary"])("laesst widerspruechliche/unlesbare %s-Antwortfelder aus", (field) => {
    const first = fixture.issues[0]; const fields = field === "summary" ? { ...first.fields, summary: null } : { ...first.fields, project: { id: field === "id" ? "202" : "101", key: field === "key" ? "OTHER" : "DEMO" } };
    expect(creationHintRows({ issues: [{ ...first, fields }] }, project)).toMatchObject({ rows: [], omitted: 1 });
  });
  it("unterscheidet leere bestaetigte Seite und unbekannte Abdeckung ohne Duplikataussage", () => {
    expect(creationHintRows({ issues: [], isLast: true }, project)).toMatchObject({ rows: [], coverage: "page-end" });
    expect(creationHintRows({ issues: [] }, project).coverage).toBe("unknown");
  });
  it("verwirft uebergrosse und schemawidrige Antworten", async () => {
    mock.jira.mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)({ issues: Array.from({ length: 11 }, () => fixture.issues[0]) }));
    await expect(read()).rejects.toMatchObject({ _tag: "JiraApiError", status: 502 });
    mock.jira.mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)({ issues: "broken" }));
    await expect(read()).rejects.toBeDefined();
  });
  it("liefert Readfehler statt stiller leerer Erfolgsliste", async () => {
    mock.jira.mockReturnValue(Effect.fail(new JiraApiError({ status: 403, body: "denied" })));
    await expect(read()).rejects.toMatchObject({ status: 403 }); expect(mock.jira).toHaveBeenCalledTimes(1);
  });
  it.each(["site", "account"])("verwirft spaete Antworten nach %s-Wechsel", async (kind) => {
    mock.jira.mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Effect.gen(function* () {
      client.setQueryData(kind === "site" ? jiraKeys.site : jiraKeys.myself, kind === "site" ? { cloudId: "other" } : { accountId: "other" });
      return yield* Schema.decodeUnknownEffect(schema)(fixture);
    }));
    await expect(read()).rejects.toMatchObject({ _tag: "JiraQueryScopeChanged" });
  });
  it("trennt Konto, Site, Formularinstanz und Entwurfsgeneration und aktiviert keine Automatik", () => {
    const base = creationHintsQuery(client, scope, request, "owner", 0);
    expect(base).toMatchObject({ enabled: false, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false, gcTime: 0 });
    for (const key of [creationHintsQuery(client, { ...scope, accountId: "other" }, request, "owner", 0).queryKey, creationHintsQuery(client, { ...scope, cloudId: "other" }, request, "owner", 0).queryKey, creationHintsQuery(client, scope, request, "other", 0).queryKey, creationHintsQuery(client, scope, request, "owner", 1).queryKey]) expect(key).not.toEqual(base.queryKey);
  });
  it("reicht echten Query-Abbruch an Effect weiter und uebernimmt keine spaete Seite", async () => {
    let started = false; let interrupted = false;
    mock.jira.mockReturnValue(Effect.gen(function* () { started = true; yield* Effect.sleep(1000); return fixture; }).pipe(Effect.ensuring(Effect.sync(() => { interrupted = true; }))));
    const options = creationHintsQuery(client, scope, request, "owner", 0); const promise = client.fetchQuery(options).catch(() => undefined);
    await vi.waitFor(() => expect(started).toBe(true)); await client.cancelQueries({ queryKey: options.queryKey, exact: true }); await promise;
    await vi.waitFor(() => expect(interrupted).toBe(true)); expect(client.getQueryData(options.queryKey)).toBeUndefined();
  });
});
