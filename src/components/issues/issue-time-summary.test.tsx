import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/issue-time.json";
import { issueTimeSummary } from "@/lib/jira/issue-time";
import { IssueTimeSummaryPanel } from "./issue-time-summary";

const mock = vi.hoisted(() => ({ add: vi.fn() }));
vi.mock("@/hooks/jira/use-issue-mutations", async (original) => ({ ...await original<typeof import("@/hooks/jira/use-issue-mutations")>(), useJiraAddWorklog: () => ({ mutateAsync: mock.add, isPending: false, error: null }) }));
vi.mock("@/components/jira-user-avatar", async (original) => ({ ...await original<typeof import("@/components/jira-user-avatar")>(), JiraUserLabel: () => null }));
const { IssueWorklog } = await import("@/components/issue-worklog");
const rowsOf = (markup: string) => [...markup.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((row) => row[1].replace(/<[^>]+>/g, " "));
const worklogMarkup = (issueKey: string, fields: Parameters<typeof IssueWorklog>[0]["fields"]) =>
  renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><IssueWorklog issueKey={issueKey} fields={fields} /></QueryClientProvider>);
beforeEach(() => mock.add.mockReset());

describe("Ticket- und Jira-Gesamtzeiten im bestehenden Zeit-Tab", () => {
  it("zeigt beide Bereiche fuer dieselben Kennzahlen nebeneinander mit Herkunft und ohne Doppelsumme", () => {
    const markup = renderToStaticMarkup(<IssueTimeSummaryPanel summary={issueTimeSummary(fixture.fields)} />);
    const rows = rowsOf(markup);
    expect(rows[0]).toContain("Nur dieses Ticket");
    expect(rows[0]).toContain("Gesamt laut Jira");
    expect(rows[1]).toMatch(/Geschätzt\s+24 h\s+48 h/);
    expect(rows[2]).toMatch(/Erfasst\s+2 h\s+5 h/);
    expect(rows[3]).toMatch(/Verbleibend\s+4 h\s+10 h/);
    expect(markup).toContain("nicht erneut dazuaddieren");
    expect(markup).not.toContain("999999");
  });
  it("unterscheidet im Markup gelieferte Nullsekunden, null und ungueltige Gesamtwerte", () => {
    const fields = { ...fixture.fields, aggregatetimeoriginalestimate: 0, aggregatetimespent: null, aggregatetimeestimate: -1 };
    const rows = rowsOf(renderToStaticMarkup(<IssueTimeSummaryPanel summary={issueTimeSummary(fields)} />));
    expect(rows[1]).toContain("0 min");
    expect(rows[1]).not.toContain("Unbekannt");
    expect(rows[2]).toMatch(/Unbekannt\s+Nicht geliefert/);
    expect(rows[3]).toMatch(/Unbekannt\s+Ungültiger Jira-Wert/);
  });
  it("kennzeichnet unveraenderte alte Jira-Textangaben als Fallback statt daraus Gesamtzeit zu erzeugen", () => {
    const rows = rowsOf(renderToStaticMarkup(<IssueTimeSummaryPanel summary={issueTimeSummary({ timetracking: { originalEstimate: "3d", timeSpent: "0m", remainingEstimate: "1w" } })} />));
    expect(rows[1]).toMatch(/3d\s+Jira-Textangabe\s+Unbekannt/);
    expect(rows[2]).toMatch(/0m\s+Jira-Textangabe\s+Unbekannt/);
  });
  it("integriert echte Hook-Ableitung und erhaelt Erfassungsformular sowie unvollstaendige Buchungsliste", () => {
    const markup = worklogMarkup("DEMO-1", fixture.fields);
    expect(rowsOf(markup)[1]).toMatch(/24 h\s+48 h/);
    expect(markup).not.toContain("Restschätzung neu setzen");
    expect(markup).toContain("Zeit erfassen");
    expect(markup).toContain("1 von 9 Einträgen angezeigt");
    expect(mock.add).not.toHaveBeenCalled();
  });
  it("uebernimmt bei neuem Ticket keine Gesamtwerte der vorherigen Anzeige", () => {
    worklogMarkup("DEMO-1", fixture.fields);
    const next = { ...fixture.fields, aggregatetimeoriginalestimate: null, aggregatetimespent: 0, aggregatetimeestimate: null };
    const rows = rowsOf(worklogMarkup("DEMO-2", next));
    expect(rows[1]).toContain("Unbekannt");
    expect(rows[1]).not.toContain("48 h");
    expect(rows[2]).toMatch(/2 h\s+0 min/);
    expect(mock.add).not.toHaveBeenCalled();
  });
});
