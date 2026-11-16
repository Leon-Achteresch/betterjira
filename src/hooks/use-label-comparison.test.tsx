import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../tests/jira/fixtures/label-comparison.json";

const mock = vi.hoisted(() => { const state: { current: unknown } = { current: null }; const latest: { current: unknown } = { current: null }; return { state, latest }; });
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: <T,>(initial: T | (() => T)) => {
    const state = actual.useState(initial); const value = state[0];
    if (typeof value === "object" && value !== null && "reference" in value && "token" in value && "context" in value) {
      const current = mock.state.current ?? value; mock.state.current = current;
      return [current, (next: unknown) => { mock.state.current = typeof next === "function" ? next(mock.state.current ?? current) : next; }];
    }
    return state;
  } };
});
vi.mock("./use-latest-ref", () => ({ useLatestRef: (value: unknown) => { mock.latest.current = value; return mock.latest; } }));
const { useLabelComparison } = await import("./use-label-comparison");
const { jiraKeys } = await import("@/lib/jira/keys");
type Input = Parameters<typeof useLabelComparison>[0]; type Model = ReturnType<typeof useLabelComparison>;
const scope = { cloudId: "site", accountId: "me" };
const input = (changes: Partial<Input> = {}): Input => ({ context: "view/JQL/sort/filter/fields/searchtext", scope, ready: true, accountLabel: "Testkonto · Site", issues: fixture.issues, selected: [], hasMore: true, readError: false, ...changes });
let client: QueryClient;
function Harness({ data, expose }: { data: Input; expose: (model: Model) => void }) { expose(useLabelComparison(data)); return null; }
const mount = (data = input()) => {
  let model: Model | undefined;
  renderToStaticMarkup(<QueryClientProvider client={client}><Harness data={data} expose={(value) => { model = value; }} /></QueryClientProvider>);
  if (!model) throw new Error("missing comparison model"); return model;
};
const open = (data = input()) => { mount(data).setOpen(true); return mount(data); };
beforeEach(() => { client = new QueryClient(); client.setQueryData(jiraKeys.site, { cloudId: "site" }); client.setQueryData(jiraKeys.myself, { accountId: "me" }); mock.state.current = null; mock.latest.current = null; });
afterEach(() => client.clear());

describe("bewusster lesender Labelvergleich", () => {
  it("prueft erst beim Oeffnen und erst nach bewusster Labelwahl", () => {
    expect(mount().inventory.checked).toBe(0); expect(open().comparison.matches).toEqual([]);
    mount().setReference("frontend");
    expect(mount().comparison.matches.map((entry) => entry.label)).toEqual(["FrontEnd", "frontent"]);
    expect(client.isFetching()).toBe(0); expect(client.isMutating()).toBe(0);
  });
  it("vergleicht ausschliesslich die aktuelle geladene Auswahl wenn vorhanden", () => {
    const data = input({ selected: fixture.issues.slice(0, 2) }); const model = open(data);
    expect(model.sourceLabel).toBe("ausgewählte geladene Tickets"); expect(model.inventory.sourceCount).toBe(2);
    expect(model.labels).not.toContain("frontent"); model.setReference("frontend");
    expect(mount(data).comparison.matches.map((entry) => entry.label)).toEqual(["FrontEnd"]);
  });
  it.each(["JQL", "sort", "filter", "view", "searchtext", "selection", "placeholder"])("schliesst bei %s-Wechsel und entwertet alte Aktionen auch nach Rueckkehr", (change) => {
    const old = open(); old.setReference("frontend");
    const changed = mount(input(change === "selection" ? { selected: fixture.issues.slice(0, 1) } : change === "placeholder" ? { ready: false } : { context: change }));
    expect(changed.open).toBe(false); expect(changed.reference).toBeNull(); mount(); old.setOpen(true); old.setReference("frontend");
    expect(mount().open).toBe(false); expect(mount().reference).toBeNull();
  });
  it.each(["account", "site"])("blockiert alte Aktionen unmittelbar nach %s-Wechsel, auch vor naechstem Render", (kind) => {
    const old = open(); client.setQueryData(kind === "account" ? jiraKeys.myself : jiraKeys.site, kind === "account" ? { accountId: "other" } : { cloudId: "other" }); old.setReference("frontend");
    const changed = mount(input({ scope: { cloudId: kind === "site" ? "other" : "site", accountId: kind === "account" ? "other" : "me" } }));
    expect(changed.open).toBe(false); expect(changed.reference).toBeNull(); expect(changed.inventory.labels).toEqual([]);
    client.setQueryData(jiraKeys.site, { cloudId: "site" }); client.setQueryData(jiraKeys.myself, { accountId: "me" });
    mount(); old.setOpen(true); old.setReference("frontend"); expect(mount().open).toBe(false); expect(mount().reference).toBeNull();
  });
  it("sperrt Placeholder, unbestaetigten Scope und leere Treffer", () => {
    for (const data of [input({ ready: false }), input({ scope: undefined }), input({ issues: [] })]) {
      const model = open(data); expect(model.disabled).toBe(true); expect(model.open).toBe(false); expect(model.inventory.labels).toEqual([]);
    }
  });
  it("nimmt keine unbekannten Werte an und entfernt verschwundene Referenzen aus der Anzeige", () => {
    open().setReference("frontend"); mount().setReference("foreign"); expect(mount().reference).toBe("frontend");
    const changed = mount(input({ issues: fixture.issues.slice(2, 3) })); expect(changed.reference).toBeNull(); expect(changed.comparison.matches).toEqual([]);
  });
  it("erhaelt Readfehler und unvollstaendige Suchmenge als Hinweise, ohne Nachladen", () => {
    const model = open(input({ readError: true, hasMore: true })); expect(model.readError).toBe(true); expect(model.hasMore).toBe(true); expect(model.inventory.checked).toBe(7);
    expect(client.isFetching()).toBe(0); expect(client.isMutating()).toBe(0);
  });
  it("aktualisiert denselben begrenzten Vergleich bei neuer Suchseite ohne neuen Lookup", () => {
    const first = input({ issues: fixture.issues.slice(0, 2) }); open(first).setReference("frontend");
    expect(mount(first).comparison.totalMatches).toBe(1);
    const next = mount(); expect(next.open).toBe(true); expect(next.comparison.totalMatches).toBe(2); expect(next.inventory.checked).toBe(7);
    expect(client.isFetching()).toBe(0); expect(client.isMutating()).toBe(0);
  });
});
