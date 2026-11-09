import { describe, expect, it } from "vitest";
import { compileJql, JqlError, parseJql, type JqlSchema } from "./mock-jql";

type Item = { key: string; status: string; labels: string[]; assignee?: string; sprint?: number; updated: string; rank: number };

const NOW = Date.UTC(2026, 10, 9, 12);

const items: Item[] = [
  { key: "A-1", status: "Done", labels: ["ux"], assignee: "me", sprint: 1, updated: "2026-11-09T11:55:00.000Z", rank: 3 },
  { key: "A-2", status: "To Do", labels: [], assignee: undefined, sprint: undefined, updated: "2026-11-01T08:00:00.000Z", rank: 1 },
  { key: "A-3", status: "In Progress", labels: ["api", "ux"], assignee: "other", sprint: 2, updated: "2026-11-08T12:00:00.000Z", rank: 2 },
];

const schema: JqlSchema<Item> = {
  fields: {
    key: { values: (item) => [item.key] },
    status: { values: (item) => [item.status] },
    labels: { values: (item) => item.labels },
    assignee: { values: (item) => (item.assignee ? [item.assignee] : []) },
    sprint: { values: (item) => (item.sprint ? [String(item.sprint)] : []) },
    updated: { values: (item) => [item.updated], type: "date" },
    summary: { values: (item) => [`Summary of ${item.key}`], type: "text" },
  },
  functions: { currentuser: () => ["me"], opensprints: () => ["2"] },
  filter: (reference) => (reference === "7" ? "status != Done ORDER BY rank" : undefined),
  sort: { rank: (item) => item.rank, key: (item) => item.key, updated: (item) => Date.parse(item.updated) },
  defaultOrder: [{ field: "key", direction: "desc" }],
  now: () => NOW,
};

const keys = (jql: string) => {
  const { matches, compare } = compileJql(jql, schema);
  return items.filter(matches).sort(compare).map((item) => item.key);
};

describe("Mock-JQL", () => {
  it("wertet AND, OR, NOT und Klammern aus", () => {
    expect(keys('status = Done OR (labels = ux AND NOT status = "To Do")')).toEqual(["A-3", "A-1"]);
    expect(keys("status in (Done, 'In Progress') ORDER BY rank ASC")).toEqual(["A-3", "A-1"]);
  });

  it("schließt leere Werte bei != und NOT IN aus, wie Jira", () => {
    expect(keys("assignee != me")).toEqual(["A-3"]);
    expect(keys("sprint not in openSprints()")).toEqual(["A-1"]);
    expect(keys("sprint is EMPTY OR sprint not in openSprints() ORDER BY rank")).toEqual(["A-2", "A-1"]);
  });

  it("kennt currentUser(), EMPTY in Listen und Textsuche", () => {
    expect(keys("assignee = currentUser()")).toEqual(["A-1"]);
    expect(keys("assignee in (EMPTY, other) ORDER BY key")).toEqual(["A-2", "A-3"]);
    expect(keys('summary ~ "a-2"')).toEqual(["A-2"]);
  });

  it("vergleicht relative und absolute Datumswerte gegen die Uhr", () => {
    expect(keys("updated >= -10m")).toEqual(["A-1"]);
    expect(keys("updated >= -2d ORDER BY updated DESC")).toEqual(["A-1", "A-3"]);
    expect(keys('updated < "2026/11/02"')).toEqual(["A-2"]);
    expect(compileJql("updated >= -1h", schema).dynamic).toBe(true);
    expect(compileJql("status = Done", schema).dynamic).toBe(false);
  });

  it.each(["2026-11-09", "2026/11/09", "2026-11-09 10:00"])("normalisiert Datumsgleichheit und Ungleichheit: %s", (date) => {
    expect(keys(`updated = "${date}"`)).toEqual(["A-1"]);
    expect(keys(`updated != "${date}"`)).toEqual(["A-3", "A-2"]);
    expect(keys(`updated in ("${date}", -1d)`)).toEqual(["A-3", "A-1"]);
    expect(keys(`updated not in ("${date}", -1d)`)).toEqual(["A-2"]);
  });

  it("wertet relative Datumswerte und leere Werte bei Datumsgleichheit konsistent aus", () => {
    expect(keys("updated = -1d")).toEqual(["A-3"]);
    expect(keys("updated != -1d")).toEqual(["A-2", "A-1"]);
    const nullable = { ...schema, fields: { ...schema.fields, updated: { ...schema.fields.updated, values: (item: Item) => item.key === "A-2" ? [] : [item.updated] } } };
    const filter = (jql: string) => items.filter(compileJql(jql, nullable).matches).map((item) => item.key);
    expect(filter('updated in (EMPTY, "2026/11/09")')).toEqual(["A-1", "A-2"]);
    expect(filter('updated != "2026/11/09"')).toEqual(["A-3"]);
    expect(() => keys('updated = "invalid-date"')).toThrow(JqlError);
  });

  it("löst gespeicherte Filter auf und sortiert nach dem Default", () => {
    expect(keys("filter = 7 ORDER BY rank")).toEqual(["A-2", "A-3"]);
    expect(keys("labels = ux")).toEqual(["A-3", "A-1"]);
  });

  it("meldet unbekannte Felder, Funktionen und Syntaxfehler wie Jira", () => {
    expect(() => compileJql("component = x", schema)).toThrow(/Field 'component' does not exist/);
    expect(() => compileJql("sprint in closedSprints()", schema)).toThrow(/Unable to find JQL function 'closedsprints\(\)'/);
    expect(() => compileJql("status = ", schema)).toThrow(JqlError);
    expect(() => compileJql("filter = 99", schema)).toThrow(/does not exist for the field 'filter'/);
    expect(() => compileJql("status = Done ORDER BY color", schema)).toThrow(/Not able to sort/);
  });

  it("erkennt reine ORDER-BY-Abfragen als unbeschränkt", () => {
    expect(parseJql("ORDER BY created DESC").where).toBeUndefined();
    expect(parseJql("").orderBy).toEqual([]);
  });
});
