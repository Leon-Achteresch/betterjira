import { describe, expect, it } from "vitest";
import { toMarkdown, toTsv } from "../table-export";
import { fieldText } from "./field-text";
import { canMoveValue, collectFacetOptions, moveValue, sortClauseOf } from "./issue-view";

describe("collectFacetOptions", () => {
  const issues = [
    { fields: { assignee: { accountId: "a1", displayName: "Zoe", avatarUrls: { "48x48": "z.png" } }, labels: ["ui", "api"] } },
    { fields: { assignee: null, labels: [] } },
    { fields: { assignee: { accountId: "a2", displayName: "Anna", avatarUrls: { "48x48": "a.png" } }, labels: ["ui"] } },
  ];

  it("sammelt Bearbeiter sortiert, Leer zuletzt", () => {
    expect(collectFacetOptions("assignee", issues).map((option) => option.label)).toEqual(["Anna", "Zoe", "Nicht zugewiesen"]);
  });

  it("dedupliziert Labels und behält gewählte Werte", () => {
    expect(collectFacetOptions("labels", issues, ["alt"]).map((option) => option.value)).toEqual(["alt", "api", "ui", "EMPTY"]);
  });
});

describe("moveValue", () => {
  it("verschiebt innerhalb der Grenzen", () => {
    expect(moveValue(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
    expect(moveValue(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
  });

  it("bleibt an beiden Enden und bei unbekannten Werten unverändert", () => {
    expect(moveValue(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(moveValue(["a", "b", "c"], "x", 1)).toEqual(["a", "b", "c"]);
    expect(moveValue([], "x", -1)).toEqual([]);
  });

  it("erzeugt über mehrere Schritte keine Duplikate und verliert nichts", () => {
    let values = ["key", "summary", "status", "assignee"];
    for (const offset of [1, 1, 1, 1, -1, -1, -1, -1, -1]) values = moveValue(values, "summary", offset);
    expect(values).toEqual(["summary", "key", "status", "assignee"]);
    expect(new Set(values).size).toBe(4);
  });

  it("verändert die Eingabe nicht und liefert immer eine neue Liste", () => {
    const values = Object.freeze(["a", "b", "c"]);
    const moved = moveValue(values, "b", -1);
    const unchanged = moveValue(values, "a", -1);
    expect(values).toEqual(["a", "b", "c"]);
    expect(moved).toEqual(["b", "a", "c"]);
    expect(unchanged).not.toBe(values);
  });
});

describe("canMoveValue", () => {
  it("sperrt die Grenzen, unbekannte Werte und Nullschritte", () => {
    const values = ["a", "b", "c"];
    expect(canMoveValue(values, "a", -1)).toBe(false);
    expect(canMoveValue(values, "a", 1)).toBe(true);
    expect(canMoveValue(values, "b", -1)).toBe(true);
    expect(canMoveValue(values, "c", 1)).toBe(false);
    expect(canMoveValue(values, "x", 1)).toBe(false);
    expect(canMoveValue(values, "b", 0)).toBe(false);
    expect(canMoveValue(values, "b", 0.5)).toBe(false);
    expect(canMoveValue(values, "b", Number.NaN)).toBe(false);
    expect(canMoveValue(values, "b", Number.POSITIVE_INFINITY)).toBe(false);
    expect(canMoveValue(["a"], "a", 1)).toBe(false);
  });
});

describe("sortClauseOf", () => {
  it("nutzt cf[] für eigene Felder und lehnt unsortierbare ab", () => {
    expect(sortClauseOf("customfield_1", { id: "customfield_1", name: "SP", orderable: true, clauseNames: ["Story Points", "cf[1]"] })).toBe("cf[1]");
    expect(sortClauseOf("labels", { id: "labels", name: "Labels", orderable: false })).toBeUndefined();
    expect(sortClauseOf("key")).toBe("key");
  });
});

describe("fieldText und Export", () => {
  it("macht Feldwerte zu Text", () => {
    expect(fieldText([{ name: "A" }, { value: "B", child: { value: "C" } }])).toBe("A, B › C");
    expect(fieldText({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hallo" }] }] })).toBe("Hallo");
  });

  it("exportiert TSV und Markdown", () => {
    expect(toTsv(["a", "b"], [["1\t2", "x\ny"]])).toBe("a\tb\n1 2\tx y");
    expect(toMarkdown(["a"], [["x|y"]])).toBe("| a |\n| --- |\n| x\\|y |");
  });
});
