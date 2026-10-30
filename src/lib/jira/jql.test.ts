import { describe, expect, it } from "vitest";
import { composeJql, cycleSort, quoteJql, splitJql, textClause, valuesClause } from "./jql";

describe("splitJql", () => {
  it("trennt ORDER BY ab", () => {
    expect(splitJql('project = "AB" order by updated DESC')).toEqual({ where: 'project = "AB"', orderBy: "updated DESC" });
  });

  it("erkennt reines ORDER BY", () => {
    expect(splitJql("ORDER BY created")).toEqual({ where: "", orderBy: "created" });
  });

  it("lässt JQL ohne Sortierung unverändert", () => {
    expect(splitJql(" filter = 10 ")).toEqual({ where: "filter = 10", orderBy: "" });
  });
});

describe("composeJql", () => {
  it("klammert die Basis und hängt Bedingungen an", () => {
    expect(composeJql("a = 1 OR b = 2 ORDER BY rank", ["c = 3", ""])).toBe("(a = 1 OR b = 2) AND c = 3 ORDER BY rank");
  });

  it("ersetzt die Sortierung", () => {
    expect(composeJql("a = 1 ORDER BY rank", [], [{ field: "updated", direction: "DESC" }, { field: "key", direction: "ASC" }])).toBe(
      "a = 1 ORDER BY updated DESC, key ASC",
    );
  });

  it("kommt ohne Basis aus", () => {
    expect(composeJql("", ["c = 3"])).toBe("c = 3");
  });
});

describe("valuesClause", () => {
  it("maskiert Werte", () => {
    expect(quoteJql('a "b" \\')).toBe('"a \\"b\\" \\\\"');
    expect(valuesClause("status", ["Offen", "In Arbeit"])).toBe('status in ("Offen", "In Arbeit")');
  });

  it("verbindet leere Werte mit ODER", () => {
    expect(valuesClause("assignee", ["EMPTY"])).toBe("assignee is EMPTY");
    expect(valuesClause("assignee", ["123", "EMPTY"])).toBe('(assignee in ("123") OR assignee is EMPTY)');
  });

  it("baut Volltextsuche", () => {
    expect(textClause("  login ")).toBe('text ~ "login*"');
    expect(textClause(" ")).toBe("");
  });
});

describe("cycleSort", () => {
  it("wechselt aufsteigend, absteigend, aus", () => {
    const asc = cycleSort([], "key", false);
    expect(asc).toEqual([{ field: "key", direction: "ASC" }]);
    const desc = cycleSort(asc, "key", false);
    expect(desc).toEqual([{ field: "key", direction: "DESC" }]);
    expect(cycleSort(desc, "key", false)).toEqual([]);
  });

  it("ergänzt mit Umschalt weitere Sortierungen", () => {
    const sort = cycleSort([{ field: "key", direction: "ASC" }], "updated", true);
    expect(sort).toEqual([
      { field: "key", direction: "ASC" },
      { field: "updated", direction: "ASC" },
    ]);
    expect(cycleSort(sort, "key", true)).toEqual([
      { field: "key", direction: "DESC" },
      { field: "updated", direction: "ASC" },
    ]);
  });
});
