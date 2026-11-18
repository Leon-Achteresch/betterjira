import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/component-leads.json";

const mock = vi.hoisted(() => { const state: { current: unknown } = { current: null }; const latest: { current: unknown } = { current: null }; return { state, latest, jira: vi.fn(), accountId: "me", confirmed: true, delay: 0 }; });
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: <T,>(initial: T | (() => T)) => {
    const state = actual.useState(initial); const value = state[0];
    if (typeof value === "object" && value !== null && "context" in value && "token" in value && "open" in value) {
      const current = mock.state.current ?? value; mock.state.current = current;
      return [current, (next: unknown) => { mock.state.current = typeof next === "function" ? next(mock.state.current ?? current) : next; }];
    }
    return state;
  } };
});
vi.mock("../use-latest-ref", () => ({ useLatestRef: (value: unknown) => { mock.latest.current = value; return mock.latest; } }));
vi.mock("@/lib/jira/client", async (original) => ({ ...await original<typeof import("@/lib/jira/client")>(), jira: mock.jira, currentSite: Effect.succeed({ cloudId: "site" }) }));
vi.mock("@/lib/jira/queries", async (original) => ({ ...await original<typeof import("@/lib/jira/queries")>(), useJiraSite: () => ({ isSuccess: true, data: { cloudId: "site" } }), useJiraMyself: () => ({ isSuccess: mock.confirmed, data: { accountId: mock.accountId } }) }));
const { useComponentLeads } = await import("./use-component-leads");
const { jiraKeys } = await import("@/lib/jira/keys");
type Model = ReturnType<typeof useComponentLeads>;
type Input = Parameters<typeof useComponentLeads>[0];
let client: QueryClient;
const input = (change: Partial<Input> = {}): Input => ({ project: { key: "DEMO", id: "101" }, context: "issue/DEMO-1", selection: fixture.components.slice(0, 3).map(({ id, name }) => ({ id, name })), ...change });
function Harness({ data, expose }: { data: Input; expose: (value: Model) => void }) { expose(useComponentLeads(data)); return null; }
const mount = (data = input()) => {
  let model: Model | undefined;
  renderToStaticMarkup(<QueryClientProvider client={client}><Harness data={data} expose={(value) => { model = value; }} /></QueryClientProvider>);
  if (!model) throw new Error("missing component model"); return model;
};
const open = (data = input()) => { mount(data).setOpen(true); return mount(data); };
const done = () => vi.waitFor(() => expect(client.isFetching()).toBe(0));
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mock.state.current = null; mock.latest.current = null; mock.accountId = "me"; mock.confirmed = true; mock.delay = 0;
  client.setQueryData(jiraKeys.site, { cloudId: "site" }); client.setQueryData(jiraKeys.myself, { accountId: "me" });
  mock.jira.mockReset().mockImplementation((path: string, schema: Schema.Decoder<unknown>) => Effect.gen(function* () {
    if (mock.delay) yield* Effect.sleep(mock.delay);
    return yield* Schema.decodeUnknownEffect(schema)(fixture.components.find((component) => path === `/component/${component.id}`));
  }));
});
afterEach(() => client.clear());
describe("bewusster Komponentenleitungs-Lookup", () => {
  it("laedt nichts beim blossen Rendern und nutzt beim Oeffnen nur die Auswahl", async () => {
    mount(); expect(mock.jira).not.toHaveBeenCalled(); const model = open(); expect(model.open).toBe(true); model.refresh(); model.refresh(); await done();
    expect(mock.jira.mock.calls.map(([path]) => path).sort()).toEqual(["/component/1", "/component/2", "/component/3"]);
    expect(mount().rows.map((row) => row.status)).toEqual(["visible", "unavailable", "unavailable"]);
  });
  it.each(["issue", "project", "selection", "account"])("schliesst bei %s-Wechsel und entwertet alte Aktionen auch nach Rueckkehr", (kind) => {
    const old = open();
    if (kind === "account") { mock.accountId = "other"; client.setQueryData(jiraKeys.myself, { accountId: "other" }); }
    const changed = mount(kind === "issue" ? input({ context: "issue/DEMO-2" }) : kind === "project" ? input({ project: { key: "OTHER", id: "202" } }) : kind === "selection" ? input({ selection: [{ id: "4" }] }) : input());
    expect(changed.open).toBe(false); mock.accountId = "me"; client.setQueryData(jiraKeys.myself, { accountId: "me" }); mount(); old.setOpen(true); old.refresh();
    expect(mount().open).toBe(false); expect(mock.jira).not.toHaveBeenCalled();
  });
  it("zeigt fuer ausschliesslich unlesbare Auswahl keinen endlosen Ladezustand", () => {
    const model = open(input({ selection: [{ name: "Ohne ID" }] }));
    expect(model.invalid).toBe(1); expect(model.loading).toBe(false); expect(model.canRefresh).toBe(false); model.refresh(); expect(mock.jira).not.toHaveBeenCalled();
  });
  it("startet ohne Projekt oder bestaetigtes Konto keine Abfrage", () => {
    expect(open(input({ project: undefined })).disabled).toBe(true); mount(input({ project: undefined })).refresh();
    mock.confirmed = false; expect(mount().disabled).toBe(true); open().refresh(); expect(mock.jira).not.toHaveBeenCalled();
  });
  it("uebernimmt eine verspaetete Antwort nach Kontowechsel nicht als sichtbare Leitung", async () => {
    mock.delay = 30; open().refresh(); mock.accountId = "other"; client.setQueryData(jiraKeys.myself, { accountId: "other" }); mount(); await done();
    expect(mount().rows.every((row) => !row.person)).toBe(true); expect(mount().open).toBe(false);
  });
});
