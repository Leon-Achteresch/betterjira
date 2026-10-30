import { describe, expect, it } from "vitest";
import { toMarkdown, toTsv } from "../table-export";
import { fieldText } from "./field-text";
import { collectFacetOptions, moveValue, sortClauseOf } from "./issue-view";

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
