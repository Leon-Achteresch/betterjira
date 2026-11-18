import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { acceptanceCriteria } from "./acceptance-criteria";
import { readCriteriaTestReview, testLinkCandidates } from "./criteria-test-review";
import { summarizeIssueLinks } from "./issue-links";

const { transport, invoke } = vi.hoisted(() => ({ transport: vi.fn(), invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: transport }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const row = (text: string) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const heading = { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Akzeptanzkriterien" }] };
const list = (content: unknown[]) => ({ type: "bulletList", content });
const doc = (...content: unknown[]) => ({ type: "doc", version: 1, content });
const source = { id: "11", key: "DEMO-1" };
const criterion = { line: 1, text: "Beleg herunterladen" };
const description = doc(heading, list([row(criterion.text), row("Historie bleibt verfügbar")]));
const type = { id: "23", name: "Tests", inward: "is tested by", outward: "tests" };
const edge = { id: "42", type, inwardIssue: { key: "DEMO-2" } };
const reverse = { id: "42", type, outwardIssue: { key: source.key } };
const [target] = testLinkCandidates(source.key, summarizeIssueLinks([edge]));
const scope = { cloudId: "qa-criteria-tests", siteUrl: "https://fixture.atlassian.net", isCurrent: () => true };
const accountId = "fixture-account";
const account = (id = accountId) => Response.json({ accountId: id });
const origin = (fields: object = {}) => Response.json({ ...source, fields: { description, issuelinks: [edge], ...fields } });
const linked = (fields: object = {}) => Response.json({ id: "12", key: "DEMO-2", fields: {
  summary: "Download eines Belegs", issuetype: { id: "725", name: "Test" }, issuelinks: [reverse], ...fields,
} });
const read = () => Effect.runPromise(readCriteriaTestReview(source, criterion, target, accountId, scope));

beforeEach(() => {
  transport.mockReset();
  invoke.mockReset().mockResolvedValue(JSON.stringify({ ...scope, siteName: "Fixture", accessToken: "synthetic", refreshToken: "synthetic", expiresAt: 9e12 }));
});

it("erhält eindeutige ADF-Zeilen samt Position neben Medien, Dubletten und verschachtelten Einträgen", () => {
  const mixed = doc({ type: "mediaSingle" }, heading, list([
    row("Doppelt"), row(" doppelt "), { type: "listItem", content: [row("In Unterliste")] },
    row("Zeile\ngeteilt"), row("X".repeat(241)), row(criterion.text),
  ]), { type: "extension" });
  const before = structuredClone(mixed);
  expect(acceptanceCriteria(mixed)).toEqual({ kind: "list", rows: [{ line: 6, text: criterion.text }], excluded: 5 });
  expect(mixed).toEqual(before);
  expect(acceptanceCriteria(doc({ ...heading, content: [{ type: "text", text: "Acceptance Criteria" }] }, {
    type: "orderedList", content: [row(criterion.text)],
  })).rows).toEqual([criterion]);
});

it.each([
  [null, "missing"],
  ["Akzeptanzkriterien\n- Scheinbarer Wiki-Eintrag", "unsupported"],
  [doc(list([row(criterion.text)])), "missing"],
  [doc(heading, heading, list([row(criterion.text)])), "unsupported"],
  [doc(heading, list([row(criterion.text)]), list([row("Zweite Liste")])), "unsupported"],
  [doc(heading, list(Array.from({ length: 31 }, (_, index) => row(`Eintrag ${index}`)))), "unsupported"],
])("liefert keine Auswahl aus unbestätigter Kriterienstruktur (%#)", (input, kind) => {
  expect(acceptanceCriteria(input)).toMatchObject({ kind, rows: [] });
});

it.each([
  [{ ...edge, id: "" }],
  [{ ...edge, type: { ...type, name: "Relates" } }],
  [{ ...edge, type: { ...type, outward: "looks like a test" } }],
  [{ ...reverse, outwardIssue: { key: "DEMO-2" } }],
  [edge, { ...edge, id: "43" }],
  [edge, { ...edge, id: "43", type: { ...type, inward: "tested by" } }],
])("bietet keine unklare Kante, bloße Namensähnlichkeit oder falsche Richtung an (%#)", (...links) => {
  expect(testLinkCandidates(source.key, summarizeIssueLinks(links))).toEqual([]);
});

it("prüft genau das gewählte Kriterium, die Test-Kante und den gelieferten Zieltyp über vier frische GETs", async () => {
  transport.mockResolvedValueOnce(account()).mockResolvedValueOnce(origin()).mockResolvedValueOnce(linked()).mockResolvedValueOnce(account());
  expect(await read()).toEqual({ criterion, source: source.key, test: { key: "DEMO-2", type: "Test", summary: "Download eines Belegs" }, relation: "is tested by" });
  expect(transport.mock.calls.map(([url, init]) => [init.method ?? "GET", new URL(url).href, init.cache, init.body])).toEqual([
    "/myself", "/issue/DEMO-1?fields=description,issuelinks", "/issue/DEMO-2?fields=summary,issuetype,issuelinks", "/myself",
  ].map((path) => ["GET", `https://api.atlassian.com/ex/jira/${scope.cloudId}/rest/api/3${path}`, "no-store", undefined]));
});

it.each([
  { initial: { description: doc(heading, list([row("Andere Zeile")])) }, subject: "criterion" },
  { initial: { description: doc(heading, list([row(criterion.text), row(criterion.text)])) }, subject: "criterion" },
  { initial: { issuelinks: [edge, { id: edge.id }] }, subject: "link" },
  { initial: { issuelinks: [{ ...edge, id: "changed" }] }, subject: "link" },
])("beendet die Prüfung vor dem Ziel bei geändertem Kriterium oder Link (%#)", async ({ initial, subject }) => {
  transport.mockResolvedValueOnce(account()).mockResolvedValueOnce(origin(initial));
  await expect(read()).rejects.toMatchObject({ _tag: "CriteriaTestUnconfirmed", subject });
  expect(transport).toHaveBeenCalledTimes(2);
});

it.each([
  { fields: { issuetype: { name: "Test" } }, subject: "test" },
  { fields: { issuetype: { id: "3", name: "Test Set" } }, subject: "test" },
  { fields: { issuelinks: [] }, subject: "link" },
])("verwirft fehlende Gegenkante oder nicht belegten Zieltyp (%#)", async ({ fields, subject }) => {
  transport.mockResolvedValueOnce(account()).mockResolvedValueOnce(origin()).mockResolvedValueOnce(linked(fields));
  await expect(read()).rejects.toMatchObject({ _tag: "CriteriaTestUnconfirmed", subject });
  expect(transport).toHaveBeenCalledTimes(3);
});

it("verwirft die Antwort bei einem Kontowechsel trotz lesbarer Quelle und lesbarem Ziel", async () => {
  transport.mockResolvedValueOnce(account()).mockResolvedValueOnce(origin()).mockResolvedValueOnce(linked()).mockResolvedValueOnce(account("other"));
  await expect(read()).rejects.toMatchObject({ _tag: "JiraRequestScopeChanged" });
  expect(transport).toHaveBeenCalledTimes(4);
});
