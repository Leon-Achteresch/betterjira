import { Effect, Schema } from "effect";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/component-leads.json";
const mock = vi.hoisted(() => ({ jira: vi.fn() }));
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), jira: mock.jira, currentSite: Effect.succeed({ cloudId: "site" }) }));
const { fetchComponentLead, fetchComponentLeads, selectedComponents, componentLeadsQuery } = await import("./component-leads");
const { JiraApiError } = await import("./client");
const { jiraKeys } = await import("./keys");
const project = { key: "DEMO", id: "101" }; const account = { cloudId: "site", accountId: "me" };
let current: boolean; const scope = { cloudId: "site", isCurrent: () => current };
let client: QueryClient;
const selected = fixture.components.map(({ id, name }) => ({ id, name }));
const read = (index = 0) => Effect.runPromise(fetchComponentLead(selected[index], project, scope));
beforeEach(() => {
  current = true; client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(jiraKeys.site, { cloudId: "site" }); client.setQueryData(jiraKeys.myself, { accountId: "me" });
  mock.jira.mockReset().mockImplementation((path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)(fixture.components.find((component) => path === `/component/${component.id}`)));
});
afterEach(() => client.clear());

describe("hinterlegte Komponentenleitung ohne Bearbeiterentscheidung", () => {
  it("uebernimmt nur IDs der Auswahl, dedupliziert und zaehlt unlesbare Eintraege", () => {
    expect(selectedComponents([{ id: "1", name: "Backend" }, { id: "1", name: "Backend" }, {}, { id: 9 }, { id: "" }])).toMatchObject({ components: [{ id: "1", name: "Backend" }], invalid: 3 });
    expect(selectedComponents(null)).toEqual({ components: [], invalid: 0 });
  });
  it("liest einen scoped GET und zeigt ausschliesslich die gelieferte Leitung", async () => {
    expect(await read()).toMatchObject({ id: "1", status: "visible", person: { name: "Alex Leitung", initials: "AL", subtitle: "Hinterlegte Komponentenleitung" } });
    expect(mock.jira.mock.calls[0][0]).toBe("/component/1"); expect(mock.jira.mock.calls[0][2]).toEqual({ scope, retry: false, cache: "no-store" });
  });
  it("ersetzt fehlende oder verborgene Leitung nicht durch Standardbearbeiter", async () => {
    for (const index of [1, 2]) { const result = await read(index); expect(result.status).toBe("unavailable"); expect(result.person).toBeUndefined(); expect(result.message).toContain("verborgen"); }
  });
  it("kennzeichnet inaktive hinterlegte Konten", async () => { expect((await read(3)).person?.subtitle).toContain("inaktiv"); });
  it.each(["id", "project", "projectId", "missing"])("verwirft nicht bestaetigte %s-Metadaten ohne Person", async (kind) => {
    const original = fixture.components[0]; const value = kind === "id" ? { ...original, id: "other" } : kind === "project" ? { ...original, project: "OTHER" } : kind === "projectId" ? { ...original, projectId: 202 } : { ...original, project: undefined, projectId: undefined };
    mock.jira.mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)(value));
    const result = await read(); expect(result.status).toBe("unverified"); expect(result.person).toBeUndefined();
  });
  it("akzeptiert belegte Projekt-ID auch ohne Key und den Key ohne bekannte ID", async () => {
    mock.jira.mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)({ ...fixture.components[0], project: undefined }));
    expect((await read()).status).toBe("visible");
    mock.jira.mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)({ ...fixture.components[0], projectId: undefined }));
    expect((await Effect.runPromise(fetchComponentLead(selected[0], { key: "DEMO" }, scope))).status).toBe("visible");
  });
  it("bewahrt unabhaengige Ergebnisse mehrerer Komponenten bei 403", async () => {
    const implementation = mock.jira.getMockImplementation()!;
    mock.jira.mockImplementation((path: string, schema: Schema.Decoder<unknown>) => path.endsWith("/2") ? Effect.fail(new JiraApiError({ status: 403, body: "hidden" })) : implementation(path, schema));
    expect((await Effect.runPromise(fetchComponentLeads(selected.slice(0, 3), project, scope))).map((row) => row.status)).toEqual(["visible", "error", "unavailable"]);
  });
  it("startet bei falschem Scope keinen Komponentenread", async () => { current = false; expect((await read()).status).toBe("error"); expect(mock.jira).not.toHaveBeenCalled(); });
  it("begrenzt gleichzeitige Reads auf drei", async () => {
    let active = 0; let peak = 0; const implementation = mock.jira.getMockImplementation()!;
    mock.jira.mockImplementation((path: string, schema: Schema.Decoder<unknown>) => Effect.gen(function* () { active++; peak = Math.max(peak, active); yield* Effect.sleep(5); active--; return yield* implementation(path, schema); }));
    await Effect.runPromise(fetchComponentLeads(selected, project, scope)); expect(peak).toBe(3);
  });
  it.each(["account", "site"])("verwirft eine spaete Antwort bei %s-Wechsel", async (kind) => {
    mock.jira.mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Effect.gen(function* () {
      client.setQueryData(kind === "account" ? jiraKeys.myself : jiraKeys.site, kind === "account" ? { accountId: "other" } : { cloudId: "other" });
      return yield* Schema.decodeUnknownEffect(schema)(fixture.components[0]);
    }));
    await expect(client.fetchQuery(componentLeadsQuery(client, account, project, selected.slice(0, 1)))).rejects.toMatchObject({ _tag: "JiraQueryScopeChanged" });
    expect(client.getQueryData(jiraKeys.componentLeads(project, ["1"], account))).toBeUndefined();
  });
  it("trennt Konto-, Projekt- und Komponentenmengen im Cache", async () => {
    await client.fetchQuery(componentLeadsQuery(client, account, project, selected.slice(0, 1)));
    for (const key of [jiraKeys.componentLeads(project, ["1"], { ...account, accountId: "other" }), jiraKeys.componentLeads({ key: "OTHER", id: "202" }, ["1"], account), jiraKeys.componentLeads(project, ["2"], account)]) expect(client.getQueryData(key)).toBeUndefined();
  });
});
