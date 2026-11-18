import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/creation-hints.json";

const mock = vi.hoisted(() => {
  const state: { current: unknown } = { current: null }; const latest: { current: unknown } = { current: null }; const flight: { current: unknown } = { current: null };
  return { state, latest, flight, refs: 0, jira: vi.fn(), navigate: vi.fn(), delay: 0, interrupted: false };
});
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return { ...actual,
    useState: <T,>(initial: T | (() => T)) => {
      const state = actual.useState(initial); const value = state[0];
      if (typeof value === "object" && value !== null && "hintToken" in value) {
        const current = mock.state.current ?? value; mock.state.current = current;
        return [current, (next: unknown) => { mock.state.current = typeof next === "function" ? next(mock.state.current ?? current) : next; }];
      }
      return state;
    },
    useRef: <T,>(initial: T) => { const ref = actual.useRef(initial); return mock.refs++ === 0 ? mock.flight : ref; },
  };
});
vi.mock("../use-latest-ref", () => ({ useLatestRef: (value: unknown) => { mock.latest.current = value; return mock.latest; } }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mock.navigate }));
vi.mock("@/lib/jira/client", async (original) => ({ ...await original<typeof import("@/lib/jira/client")>(), jira: mock.jira, currentSite: Effect.succeed({ cloudId: "site" }) }));
const { useCreationHints } = await import("./use-creation-hints");
const { jiraKeys } = await import("@/lib/jira/keys");
const { JiraApiError } = await import("@/lib/jira/client");
type Input = Parameters<typeof useCreationHints>[0]; type Model = ReturnType<typeof useCreationHints>;
const revision = { summary: "Gateway Fehler", description: null }; const scope = { cloudId: "site", accountId: "me" };
const input = (change: Partial<Input> = {}): Input => ({ project: { id: "101", key: "DEMO", name: "Demo" }, summary: "Gateway Fehler", revision, context: "create/type/parent", scope, ready: true, accountLabel: "Testkonto · Site", ...change });
let client: QueryClient;
function Harness({ data, expose }: { data: Input; expose: (model: Model) => void }) { expose(useCreationHints(data)); return null; }
const mount = (data = input()) => {
  let model: Model | undefined; mock.refs = 0;
  renderToStaticMarkup(<QueryClientProvider client={client}><Harness data={data} expose={(value) => { model = value; }} /></QueryClientProvider>);
  if (!model) throw new Error("missing hint model"); return model;
};
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(jiraKeys.site, { cloudId: "site" }); client.setQueryData(jiraKeys.myself, { accountId: "me" });
  mock.state.current = null; mock.latest.current = null; mock.flight.current = null; mock.delay = 0; mock.interrupted = false; mock.navigate.mockReset();
  mock.jira.mockReset().mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Effect.gen(function* () {
    if (mock.delay) yield* Effect.sleep(mock.delay);
    return yield* Schema.decodeUnknownEffect(schema)(fixture);
  }).pipe(Effect.ensuring(Effect.sync(() => { mock.interrupted = true; }))));
});
afterEach(() => client.clear());
describe("bewusst gestartete Suche im aktuellen Erstellkontext", () => {
  it("liest weder beim Rendern noch Eingeben und liefert erst nach ausdruecklicher Aktion Hinweise", async () => {
    mount(); mount(input({ summary: "Anderer Titel", revision: { ...revision } })); expect(mock.jira).not.toHaveBeenCalled();
    const model = mount(); await model.start(); const completed = mount();
    expect(completed.phase).toBe("done"); expect(completed.result?.rows.map((row) => row.key)).toEqual(["DEMO-1", "DEMO-2", "DEMO-5"]);
    expect(mock.jira).toHaveBeenCalledTimes(1); expect(mock.navigate).not.toHaveBeenCalled(); expect(client.isMutating()).toBe(0);
  });
  it("blockiert Doppelstart und parallele Formularaktionen desselben Laufs", async () => {
    mock.delay = 10; const model = mount(); await Promise.all([model.start(), model.start()]); expect(mock.jira).toHaveBeenCalledTimes(1);
  });
  it.each(["summary", "description", "field", "project", "type", "parent", "ready"])("entwertet alte Ergebnisse und Aktionen bei %s-Wechsel auch nach Rueckkehr", async (kind) => {
    const initial = mount(); await initial.start(); const old = mount(); expect(old.result?.rows.length).toBe(3);
    mount(input(kind === "summary" ? { summary: "Neuer Titel" } : kind === "description" ? { revision: { ...revision, description: "neu" } } : kind === "field" ? { revision: { ...revision, custom: "neu" } } : kind === "project" ? { project: { id: "202", key: "OTHER" } } : kind === "ready" ? { ready: false } : { context: kind }));
    const returned = mount(); expect(returned.open).toBe(false); expect(returned.result).toBeUndefined();
    old.openIssue("DEMO-1"); await old.start(); expect(mock.navigate).not.toHaveBeenCalled(); expect(mock.jira).toHaveBeenCalledTimes(1);
  });
  it("ignoriert eine spaete Antwort nach neuer lokaler Entwurfsrevision", async () => {
    mock.delay = 30; const promise = mount().start(); const changed = input({ revision: { ...revision, description: "bleibt lokal" } }); mount(changed); await promise;
    expect(mount(changed).result).toBeUndefined(); expect(mount(changed).phase).toBe("idle"); expect(mock.navigate).not.toHaveBeenCalled();
  });
  it.each(["account", "site"])("prueft den %s-Scope vor Aktion und nach Antwort", async (kind) => {
    const model = mount(); client.setQueryData(kind === "account" ? jiraKeys.myself : jiraKeys.site, kind === "account" ? { accountId: "other" } : { cloudId: "other" });
    await model.start(); expect(mock.jira).not.toHaveBeenCalled();
    client.setQueryData(jiraKeys.site, { cloudId: "site" }); client.setQueryData(jiraKeys.myself, { accountId: "me" });
    mock.delay = 30; const promise = model.start(); await vi.waitFor(() => expect(mock.jira).toHaveBeenCalledTimes(1), { interval: 1 });
    client.setQueryData(kind === "account" ? jiraKeys.myself : jiraKeys.site, kind === "account" ? { accountId: "other" } : { cloudId: "other" });
    const changed = input({ scope: { cloudId: kind === "site" ? "other" : "site", accountId: kind === "account" ? "other" : "me" } }); mount(changed); await promise;
    expect(mount(changed).result).toBeUndefined(); model.openIssue("DEMO-1"); expect(mock.navigate).not.toHaveBeenCalled();
  });
  it("bricht echten Effect-Read ab und uebernimmt keine spaete Seite", async () => {
    mock.delay = 1000; const model = mount(); const promise = model.start(); await vi.waitFor(() => expect(mock.jira).toHaveBeenCalledTimes(1));
    mount().stop(); await promise; await vi.waitFor(() => expect(mock.interrupted).toBe(true));
    expect(mount().phase).toBe("cancelled"); expect(mount().result).toBeUndefined(); expect(client.isFetching()).toBe(0);
  });
  it("schliesst bei bewusstem Abbruch des Popovers und bewahrt die Eingaberevision", async () => {
    mock.delay = 1000; const data = input(); const promise = mount(data).start(); await vi.waitFor(() => expect(mock.jira).toHaveBeenCalledTimes(1));
    mount(data).setOpen(false); await promise; expect(mount(data).open).toBe(false); expect(data.revision).toBe(revision);
  });
  it("behandelt leere Ergebnisse und 403 unterschiedlich und erlaubt einen neuen bewussten Versuch", async () => {
    mock.jira.mockReturnValue(Effect.succeed({ issues: [], isLast: true })); await mount().start(); expect(mount().result?.rows).toEqual([]);
    mock.jira.mockReturnValue(Effect.fail(new JiraApiError({ status: 403, body: "denied" }))); await mount().start(); expect(mount().phase).toBe("error"); expect(mount().result).toBeUndefined();
    mock.jira.mockReturnValue(Effect.succeed(fixture)); await mount().start(); expect(mount().phase).toBe("done"); expect(mock.jira).toHaveBeenCalledTimes(3);
  });
  it("oeffnet nur bestaetigte angezeigte Tickets und blockiert alte Navigation nach Scopewechsel", async () => {
    await mount().start(); const model = mount(); model.openIssue("OTHER-3"); expect(mock.navigate).not.toHaveBeenCalled();
    model.openIssue("DEMO-1"); expect(mock.navigate).toHaveBeenCalledWith({ to: "/issue/$key", params: { key: "DEMO-1" } });
    mock.navigate.mockClear(); client.setQueryData(jiraKeys.myself, { accountId: "other" }); model.openIssue("DEMO-1"); expect(mock.navigate).not.toHaveBeenCalled();
  });
  it("startet ohne lesbare Eingabe, bestaetigtes Projekt oder bereiten Erstellkontext nicht", async () => {
    for (const change of [{ ready: false }, { project: undefined }, { summary: "UI" }, { scope: undefined }]) { const model = mount(input(change)); expect(model.canStart).toBe(false); await model.start(); }
    expect(mock.jira).not.toHaveBeenCalled();
  });
});
