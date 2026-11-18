import { QueryClient } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/label-comparison.json";
import { collectComparisonLabels, compareLabelVariants, LABEL_COMPARISON_LIMITS } from "./label-comparison";
import type { SearchIssue } from "./search";

const mock = vi.hoisted(() => ({ jira: vi.fn() }));
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), jira: mock.jira, currentSite: Effect.succeed({ cloudId: "site" }) }));
const { issueSearchQuery } = await import("./search-query");
const { jiraKeys } = await import("./keys");
const issue = (index: number, labels: unknown): SearchIssue => ({ id: String(index), key: `TEST-${index}`, fields: { labels } });
const labels = (...values: string[]) => collectComparisonLabels([issue(1, values)]).labels;

describe("begrenzter Vergleich unveraenderter Labelschreibweisen", () => {
  it("zaehlt jede Schreibweise einmal pro eindeutigem Ticket und erhaelt Originale", () => {
    const inventory = collectComparisonLabels([...fixture.issues, fixture.issues[0], { ...fixture.issues[0], id: "other" }]);
    expect(inventory.labels.find((entry) => entry.label === "frontend")).toEqual({ label: "frontend", count: 2, examples: ["DEMO-1", "DEMO-4"] });
    expect(inventory.labels.find((entry) => entry.label === "FrontEnd")?.count).toBe(1);
    expect(inventory).toMatchObject({ sourceCount: 9, checked: 7, unreadable: 2, invalid: 3, omitted: 0 });
  });
  it("unterscheidet unbekannte, leere und teilweise ungueltige Felder", () => {
    const inventory = collectComparisonLabels([issue(1, undefined), issue(2, []), issue(3, ["valid", {}, " ", "x".repeat(256)])]);
    expect(inventory).toMatchObject({ checked: 3, unreadable: 1, invalid: 3 });
    expect(inventory.labels.map((entry) => entry.label)).toEqual(["valid"]);
  });
  it("stellt case-/trennzeichen-/einzeichen-aehnliche Originale mit Grund gegenueber", () => {
    const inventory = collectComparisonLabels(fixture.issues);
    expect(compareLabelVariants(inventory.labels, "api-gateway").matches.map((entry) => [entry.label, entry.rank])).toEqual([["API-Gateway", 0], ["api_gateway", 1], ["api.gateway", 1]]);
    const result = compareLabelVariants(inventory.labels, "frontend");
    expect(result.selected?.label).toBe("frontend");
    expect(result.matches.map((entry) => entry.label)).toEqual(["FrontEnd", "frontent"]);
    expect(result.matches[1].reason).toBe("Ein Zeichen Unterschied");
  });
  it.each([["review", "reviews"], ["reviews", "review"], ["review", "reviem"]])("erkennt genau eine Einfuegung/Entfernung/Ersetzung: %s / %s", (left, right) => {
    expect(compareLabelVariants(labels(left, right), left).totalMatches).toBe(1);
  });
  it.each([["api", "app"], ["frontend", "frontendsx"], ["cat", "feline"], ["review", "revwie"], ["___", "..."]])("setzt %s und %s nicht automatisch gleich", (left, right) => {
    expect(compareLabelVariants(labels(left, right), left).totalMatches).toBe(0);
  });
  it("erkennt Unicode-Darstellungen ohne Akzente oder Rohwerte zu entfernen", () => {
    const source = labels("café", "cafe\u0301", "cafe");
    const result = compareLabelVariants(source, "café");
    expect(result.matches.map((entry) => entry.label)).toEqual(["cafe\u0301"]);
    expect(source.map((entry) => entry.label)).toContain("cafe\u0301");
  });
  it("begrenzt Tickets, Werte je Ticket, Schreibweisen und Beispiele ohne falsche exakte Gesamtzahl", () => {
    const inventory = collectComparisonLabels(Array.from({ length: 1005 }, (_, i) => issue(i, ["same", ...Array.from({ length: 110 }, (_, n) => `label-${i}-${n}`)])));
    expect(inventory).toMatchObject({ sourceCount: 1005, checked: 1000, limitedIssues: 5 });
    expect(inventory.labels).toHaveLength(500); expect(inventory.omitted).toBeGreaterThan(0);
    expect(inventory.labels.find((entry) => entry.label === "same")).toEqual({ label: "same", count: 1000, examples: ["TEST-0", "TEST-1", "TEST-2"] });
    expect(inventory.labels.some((entry) => entry.label === "label-0-109")).toBe(false);
  });
  it("begrenzt Vergleiche auf 500 Schreibweisen und zeigt hoechstens 20 Hinweise", () => {
    const source = labels("aaaaa", ...Array.from({ length: 40 }, (_, i) => `${String.fromCharCode(65 + i)}aaaa`));
    const result = compareLabelVariants(source, "aaaaa");
    expect(result.matches).toHaveLength(LABEL_COMPARISON_LIMITS.matches); expect(result.totalMatches).toBeGreaterThan(20);
    expect(compareLabelVariants(source, "foreign").selected).toBeUndefined();
    const tooMany = Array.from({ length: 600 }, (_, i) => ({ label: `label-${i}`, count: 1, examples: ["TEST-1"] }));
    expect(compareLabelVariants(tooMany, "label-599").selected).toBeUndefined();
  });
  it("verwendet den vorhandenen scoped Suchread samt labels und keine Woerterbuch-/Schreib-API", async () => {
    const client = new QueryClient(); const scope = { cloudId: "site", accountId: "me" };
    client.setQueryData(jiraKeys.site, { cloudId: "site" }); client.setQueryData(jiraKeys.myself, { accountId: "me" });
    mock.jira.mockReset().mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)(fixture));
    try {
      const data = await client.fetchInfiniteQuery(issueSearchQuery("project = DEMO", ["summary", "labels"], 50, { client, scope }));
      expect(collectComparisonLabels(data.pages[0].issues).labels).toHaveLength(8);
      expect(mock.jira).toHaveBeenCalledTimes(1);
      const [path, , options] = mock.jira.mock.calls[0]; const params = new URL(path, "https://jira.test").searchParams;
      expect(params.get("fields")).toBe("labels,summary"); expect(params.get("jql")).toBe("project = DEMO");
      expect(options.scope.cloudId).toBe("site"); expect(options.method).toBeUndefined();
    } finally { client.clear(); }
  });
});
