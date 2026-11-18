import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchIssue } from "@/lib/jira/search";

const mock = vi.hoisted(() => { const state: { current: unknown } = { current: null }; const latest: { current: unknown } = { current: null }; return { state, latest, copy: vi.fn() }; });
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: <T,>(initial: T | (() => T)) => {
    const state = actual.useState(initial); const value = state[0];
    if (typeof value === "object" && value !== null && "token" in value && "context" in value) {
      const current = mock.state.current ?? value; mock.state.current = current;
      return [current, (next: unknown) => { mock.state.current = typeof next === "function" ? next(mock.state.current ?? current) : next; }];
    }
    return state;
  } };
});
vi.mock("./use-latest-ref", () => ({ useLatestRef: (value: unknown) => { mock.latest.current = value; return mock.latest; } }));
vi.mock("@/lib/clipboard", () => ({ copyToClipboard: mock.copy }));
const { useIssueTableCopy } = await import("./use-issue-table-copy");
const { jiraKeys } = await import("@/lib/jira/keys");
type Input = Parameters<typeof useIssueTableCopy>[0];
const scope = { cloudId: "site", accountId: "me" };
const issues: SearchIssue[] = [{ id: "1", key: "DEMO-1", fields: { summary: "Text\tmit\nUmbruch" } }, { id: "2", key: "DEMO-2", fields: { summary: "A|B" } }];
let client: QueryClient;
const input = (changes: Partial<Input> = {}): Input => ({ context: "site/account/JQL/sort/filter/fields", scope, ready: true, jql: "project = DEMO", issues, selected: issues.slice(1), columns: [{ id: "key", label: "Schlüssel" }, { id: "summary", label: "Zusammenfassung" }], ...changes });
function Harness({ data, expose }: { data: Input; expose: (copy: ReturnType<typeof useIssueTableCopy>) => void }) { expose(useIssueTableCopy(data)); return null; }
const mount = (data = input()) => {
  let copy: ReturnType<typeof useIssueTableCopy> | undefined;
  renderToStaticMarkup(<QueryClientProvider client={client}><Harness data={data} expose={(value) => { copy = value; }} /></QueryClientProvider>);
  if (!copy) throw new Error("missing copy"); return copy;
};
beforeEach(() => { client = new QueryClient(); client.setQueryData(jiraKeys.site, { cloudId: "site" }); client.setQueryData(jiraKeys.myself, { accountId: "me" }); mock.state.current = null; mock.latest.current = null; mock.copy.mockReset(); });
afterEach(() => client.clear());

describe("bewusste Kopie ausschliesslich aktueller geladener Treffer", () => {
  it("schreibt erst durch expliziten Callback und verwendet die bestehende TSV-Formatierung", async () => {
    const copy = mount(); expect(mock.copy).not.toHaveBeenCalled(); await copy("tsv");
    expect(mock.copy).toHaveBeenCalledWith("Schlüssel\tZusammenfassung\nDEMO-1\tText mit Umbruch\nDEMO-2\tA|B", "2 Zeilen kopiert");
  });
  it("kopiert auf Wunsch nur die bewusste Auswahl, samt Markdown-Escaping und Schluesselliste", async () => {
    const copy = mount(); await copy("markdown", true); expect(mock.copy.mock.calls[0][0]).toContain("| DEMO-2 | A\\|B |"); expect(mock.copy.mock.calls[0][0]).not.toContain("DEMO-1");
    await copy("keys", true); expect(mock.copy).toHaveBeenLastCalledWith("DEMO-2", "1 Schlüssel kopiert");
  });
  it.each(["JQL", "sort", "filter", "columns", "account"])("sperrt alte Copy-Callbacks nach %s-Wechsel auch bei Rueckkehr", async (context) => {
    const copy = mount(); mount(input({ context })); mount(); await copy("tsv"); expect(mock.copy).not.toHaveBeenCalled();
  });
  it("kopiert bei unbestaetigtem Scope oder Placeholder keine Ticketdaten", async () => {
    await mount(input({ ready: false }))("tsv");
    client.setQueryData(jiraKeys.myself, { accountId: "other" }); await mount()("keys"); expect(mock.copy).not.toHaveBeenCalled();
  });
  it("erhaelt die reine bewusste JQL-Kopie auch ohne geladene Treffer", async () => { await mount(input({ ready: false, issues: [] }))("jql"); expect(mock.copy).toHaveBeenCalledWith("project = DEMO", "JQL kopiert"); });
});
