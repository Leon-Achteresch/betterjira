import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../tests/jira/fixtures/label-comparison.json";
import type { useLabelComparison } from "./use-label-comparison";
import type { SearchIssue } from "@/lib/jira/search";

const mock = vi.hoisted(() => {
  const requests: { jql: string; fields: readonly string[] }[] = [];
  const inputs: Parameters<typeof useLabelComparison>[0][] = [];
  const selected: SearchIssue[] = [];
  return { requests, inputs, selected, placeholder: false, readError: false };
});
vi.mock("./use-label-comparison", async (original) => {
  const actual = await original<typeof import("./use-label-comparison")>();
  return { ...actual, useLabelComparison: (input: Parameters<typeof useLabelComparison>[0]) => { mock.inputs.push(input); return actual.useLabelComparison(input); } };
});
vi.mock("@/hooks/jira/use-issue-search", () => ({ useIssueSearch: (jql: string, fields: readonly string[]) => { mock.requests.push({ jql, fields }); return { data: { pages: [fixture] }, scope: { cloudId: "site", accountId: "me" }, isPlaceholderData: mock.placeholder, hasNextPage: true, error: mock.readError ? new Error("read failed") : null }; } }));
vi.mock("@/hooks/jira/use-jira-account-scope", () => ({ useJiraAccountScope: () => ({ scope: "site/me", accountLabel: "Testkonto · Site" }) }));
vi.mock("@/hooks/jira/use-field-catalog", () => ({ useFieldCatalog: () => ({ data: [] }) }));
vi.mock("@/hooks/jira/use-issue-count", () => ({ useIssueCount: () => ({ data: { count: 20 } }) }));
vi.mock("@/hooks/jira/use-bulk-edit", () => ({ useBulkEdit: () => ({ pending: false }) }));
vi.mock("@/hooks/jira/use-search-load", () => ({ useSearchLoad: () => ({ pending: false }) }));
vi.mock("@/hooks/use-interface-state", () => ({ useTableSearch: () => ({ text: "", setText: vi.fn() }) }));
vi.mock("@/hooks/use-issue-selection", () => ({ useIssueSelection: () => ({ selected: mock.selected }) }));
vi.mock("@/hooks/use-issue-view-transfer", () => ({ useIssueViewTransfer: () => ({}) }));
vi.mock("@/hooks/use-issue-table-copy", () => ({ useIssueTableCopy: () => vi.fn() }));
const { useIssueTable } = await import("./use-issue-table");
const { jiraKeys } = await import("@/lib/jira/keys");
let client: QueryClient;
function Harness({ pending = false }: { pending?: boolean }) { useIssueTable("test", "project = DEMO", { value: "", onChange: vi.fn(), placeholder: "Suchen", pending }); return null; }
const mount = (pending = false) => renderToStaticMarkup(<QueryClientProvider client={client}><Harness pending={pending} /></QueryClientProvider>);
beforeEach(() => {
  client = new QueryClient(); client.setQueryData(jiraKeys.site, { cloudId: "site" }); client.setQueryData(jiraKeys.myself, { accountId: "me" });
  mock.requests.length = 0; mock.inputs.length = 0; mock.selected.length = 0; mock.placeholder = false; mock.readError = false;
});
afterEach(() => client.clear());
describe("Labelvergleich am bestehenden Tabellenvertrag", () => {
  it("fordert labels im Hauptsuchread an und reicht aktuelle Treffer, Auswahl und Scope weiter", () => {
    mock.selected.push(fixture.issues[1]); mount();
    expect(mock.requests[0].fields).toContain("labels"); expect(mock.requests[0].jql).toBe("project = DEMO");
    expect(mock.inputs[0]).toMatchObject({ scope: { cloudId: "site", accountId: "me" }, ready: true, accountLabel: "Testkonto · Site", selected: [fixture.issues[1]], issues: fixture.issues, hasMore: true });
    expect(mock.requests).toHaveLength(2);
  });
  it("sperrt Placeholder und noch nicht uebernommenen Suchtext; meldet Fehler neben geladenem Bestand", () => {
    mock.placeholder = true; mount(); expect(mock.inputs.at(-1)?.ready).toBe(false);
    mock.placeholder = false; mount(true); expect(mock.inputs.at(-1)?.ready).toBe(false);
    mock.readError = true; mount(); expect(mock.inputs.at(-1)).toMatchObject({ ready: true, readError: true, issues: fixture.issues });
  });
});
