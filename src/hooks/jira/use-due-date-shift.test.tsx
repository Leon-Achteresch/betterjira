import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/due-date-shift.json";

const mock = vi.hoisted(() => {
  const draft: { current: unknown } = { current: null };
  const latest: { current: unknown } = { current: null };
  return { draft, latest, jira: vi.fn(), jiraSend: vi.fn(), site: { cloudId: "site", siteName: "Test-Site" }, account: { accountId: "me", displayName: "Test" } };
});
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: <T,>(initial: T | (() => T)) => {
    const state = actual.useState(initial);
    const value = state[0];
    if (typeof value === "object" && value !== null && "token" in value && typeof value.token === "symbol" && "context" in value && "preview" in value) {
      const draft = mock.draft.current ?? value;
      mock.draft.current = draft;
      return [draft, (next: unknown) => { mock.draft.current = typeof next === "function" ? next(mock.draft.current ?? draft) : next; }];
    }
    return state;
  } };
});
vi.mock("../use-latest-ref", () => ({ useLatestRef: (value: unknown) => { mock.latest.current = value; return mock.latest; } }));
vi.mock("@/lib/jira/client", async (original) => ({ ...await original<typeof import("@/lib/jira/client")>(), ...mock, currentSite: Effect.sync(() => mock.site) }));
vi.mock("./use-jira", async (original) => ({ ...await original<typeof import("./use-jira")>(), useJiraSite: () => ({ isSuccess: true, data: mock.site }), useJiraMyself: () => ({ isSuccess: true, data: mock.account }) }));
const { useDueDateShift } = await import("./use-due-date-shift");
const { JiraAuthError } = await import("@/lib/jira/client");
const { jiraKeys } = await import("@/lib/jira/keys");
type Model = ReturnType<typeof useDueDateShift>;
type Inputs = { keys?: readonly string[]; context?: string; enabled?: boolean; disabled?: boolean };
let client: QueryClient;

function Harness({ inputs, expose }: { inputs: Inputs; expose: (value: Model) => void }) {
  expose(useDueDateShift(inputs.keys ?? ["DEMO-1", "DEMO-2"], inputs.disabled ?? false, inputs.enabled ?? true, inputs.context ?? "table"));
  return null;
}
const mount = (inputs: Inputs = {}) => {
  let model: Model | undefined;
  renderToStaticMarkup(<QueryClientProvider client={client}><Harness inputs={inputs} expose={(value) => { model = value; }} /></QueryClientProvider>);
  if (!model) throw new Error("missing model");
  return model;
};
const choose = async () => {
  mount().setInput("2");
  mount().requestPreview();
  await vi.waitFor(() => expect(mount().preview).not.toBeNull());
  return mount();
};
const done = () => vi.waitFor(() => { expect(client.isMutating()).toBe(0); expect(mount().preview).toBeNull(); });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  mock.draft.current = null;
  mock.latest.current = null;
  mock.account = { accountId: "me", displayName: "Test" };
  client.setQueryData(jiraKeys.site, mock.site);
  client.setQueryData(jiraKeys.myself, mock.account);
  mock.jira.mockReset().mockImplementation((path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)(
    path.endsWith("/editmeta") ? { fields: { duedate: { operations: ["set"] } } }
      : path.startsWith("/mypermissions") ? { permissions: { EDIT_ISSUES: { havePermission: true }, SCHEDULE_ISSUES: { havePermission: true } } }
      : fixture.issues.find((issue) => path.startsWith(`/issue/${issue.key}?`)),
  ));
  mock.jiraSend.mockReset().mockReturnValue(Effect.void);
});
afterEach(() => client.clear());

describe("bewusst bestaetigte Faelligkeitsverschiebung im Hook", () => {
  it("liest die Vorschau frisch und schreibt weder bei Eingabe noch Vorschau", async () => {
    const model = await choose();
    expect(model.preview?.rows.map((row) => [row.beforeLabel, row.afterLabel])).toEqual([["2026-03-28", "2026-03-30"], ["2026-10-24", "2026-10-26"]]);
    expect(model.accountLabel).toBe("Test · Test-Site");
    expect(model.canConfirm).toBe(true);
    expect(mock.jira).toHaveBeenCalledTimes(6);
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });
  it("sperrt Doppelbestaetigung, verbraucht die Vorschau und zeigt Ergebnisse je Issue", async () => {
    const model = await choose();
    model.confirm();
    model.confirm();
    await done();
    model.confirm();
    expect(mock.jiraSend).toHaveBeenCalledTimes(2);
    expect(mount().results.map((result) => result.status)).toEqual(["changed", "changed"]);
  });
  it.each(["keys", "filter", "disabled", "closed", "account"])("verwirft nach %s-Wechsel auch alte Bestaetigungsaktionen", async (part) => {
    const model = await choose();
    if (part === "account") {
      mock.account = { accountId: "other", displayName: "Other" };
      client.setQueryData(jiraKeys.myself, mock.account);
    }
    const changed = mount(part === "keys" ? { keys: ["DEMO-1"] } : part === "filter" ? { context: "different filter" } : part === "disabled" ? { disabled: true } : part === "closed" ? { enabled: false } : {});
    expect(changed.preview).toBeNull();
    model.confirm();
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });
  it("verwirft die Vorschau bei neuer Tageszahl statt mit altem Offset zu schreiben", async () => {
    const old = await choose();
    old.setInput("-3");
    expect(mount().preview).toBeNull();
    old.confirm();
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });
  it("laedt fuer ungueltige Tage und leere Auswahl keine Vorschau", () => {
    mount().setInput("1.5");
    expect(mount().canPreview).toBe(false);
    mount().requestPreview();
    mount({ keys: [] }).requestPreview();
    expect(mock.jira).not.toHaveBeenCalled();
  });
  it("ignoriert eine verspätete Vorschau nach Kontextwechsel", async () => {
    let finish: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    const implementation = mock.jira.getMockImplementation()!;
    mock.jira.mockImplementation((path: string, schema: Schema.Decoder<unknown>) => Effect.promise(() => gate).pipe(Effect.flatMap(() => implementation(path, schema))));
    mount().setInput("2");
    mount().requestPreview();
    await vi.waitFor(() => expect(mock.jira).toHaveBeenCalled());
    mount({ context: "other" });
    finish();
    await vi.waitFor(() => expect(client.isFetching()).toBe(0));
    expect(mount({ context: "other" }).preview).toBeNull();
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });
  it("setzt nach Kontextwechsel plus Rueckkehr keine weiteren Writes fort", async () => {
    const model = await choose();
    let finish: () => void = () => undefined;
    mock.jiraSend.mockReturnValue(Effect.promise(() => new Promise<void>((resolve) => { finish = resolve; })));
    model.confirm();
    await vi.waitFor(() => expect(mock.jiraSend).toHaveBeenCalledOnce());
    mount({ context: "other" });
    mount();
    finish();
    await done();
    expect(mock.jiraSend).toHaveBeenCalledOnce();
    expect(mount().results).toEqual([]);
  });
  it("stoppt nur ungesendete Writes und bewahrt bestaetigten Teilerfolg", async () => {
    const model = await choose();
    let finish: () => void = () => undefined;
    mock.jiraSend.mockReturnValue(Effect.promise(() => new Promise<void>((resolve) => { finish = resolve; })));
    model.confirm();
    await vi.waitFor(() => expect(mock.jiraSend).toHaveBeenCalledOnce());
    model.setInput("30");
    model.stop();
    finish();
    await done();
    expect(mock.jiraSend).toHaveBeenCalledOnce();
    expect(mount().results.map((result) => result.status)).toEqual(["changed", "skipped"]);
    expect(mount().input).toBe("2");
  });
  it("bietet nach unklarem Write kein blindes Wiederholen derselben Vorschau", async () => {
    const model = await choose();
    mock.jiraSend.mockReturnValue(Effect.fail(new JiraAuthError({ message: "connection lost" })));
    model.confirm();
    await done();
    expect(mount().results.every((result) => result.status === "uncertain")).toBe(true);
    model.confirm();
    expect(mock.jiraSend).toHaveBeenCalledTimes(2);
    expect(mount().canConfirm).toBe(false);
  });
});
