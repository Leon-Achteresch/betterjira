import { describe, expect, it } from "vitest";
import { commentSearchSummary, commentText, filterComments, filterThreads } from "./comment-search";

const doc = (...content: unknown[]) => ({ type: "doc", version: 1, content });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (value: string) => ({ type: "text", text: value });

const comments = [
  { id: "1", author: { displayName: "Alex Beispiel" }, body: doc(paragraph(text("Erste Fassung ist bereit."))) },
  {
    id: "2",
    author: { displayName: "Sam Muster" },
    body: doc(
      paragraph(text("Zeile eins"), { type: "hardBreak" }, text("Zeile zwei")),
      { type: "bulletList", content: [{ type: "listItem", content: [paragraph(text("Prüfung (Teil 2) + 50 % [offen]"))] }] },
      paragraph({ type: "mention", attrs: { id: "x", text: "@Kim Probe" } }),
    ),
  },
  { id: "3", body: "<b>Rohtext</b> ohne Autor" },
  { id: "4", author: { displayName: "Jo Test" }, body: { unbekannt: true } },
];

const ids = (query: string) => filterComments(comments, query).map((comment) => comment.id);

describe("filterComments", () => {
  it("findet nach Text und Autor ohne Groß-/Kleinschreibung", () => {
    expect(ids("fassung")).toEqual(["1"]);
    expect(ids("SAM muster")).toEqual(["2"]);
    expect(ids("jo test")).toEqual(["4"]);
  });

  it("liest mehrzeiliges ADF mit Listen und Erwähnungen", () => {
    expect(ids("zeile zwei")).toEqual(["2"]);
    expect(ids("eins   Zeile zwei")).toEqual(["2"]);
    expect(ids("@kim")).toEqual(["2"]);
  });

  it("behandelt Sonderzeichen wörtlich", () => {
    expect(ids("(teil 2) + 50 % [offen]")).toEqual(["2"]);
    expect(ids(".*")).toEqual([]);
    expect(ids("<b>")).toEqual(["3"]);
  });

  it("gibt bei leerer Suche alle Kommentare in gleicher Reihenfolge zurück", () => {
    expect(filterComments(comments, "")).toBe(comments);
    expect(filterComments(comments, "   ")).toBe(comments);
  });

  it("liefert für unbekannte Inhalte keinen Text", () => {
    expect(commentText({ unbekannt: true })).toBe("");
    expect(commentText(null)).toBe("");
  });
});

describe("commentSearchSummary", () => {
  it("nennt gefundene gegenüber geladenen Kommentaren", () => {
    expect(commentSearchSummary(2, 5, "test")).toBe("2 von 5 geladenen Kommentaren");
    expect(commentSearchSummary(0, 1, "x")).toBe("0 von 1 geladenen Kommentar");
    expect(commentSearchSummary(5, 5, " ")).toBe("In 5 geladenen Kommentaren suchen");
  });
});

describe("filterThreads", () => {
  const entry = (id: string, value: string) => ({ id, author: { displayName: `Person ${id}` }, body: value });
  const threads = [
    { root: entry("1", "Wurzel eins"), replies: [entry("2", "Antwort mit Treffer"), entry("3", "andere Antwort")] },
    { root: entry("4", "Treffer in der Wurzel"), replies: [entry("5", "nichts")] },
    { root: entry("6", "ohne"), replies: [entry("7", "auch ohne")] },
  ];
  const shape = (query: string) =>
    filterThreads(threads, query).map(({ root, replies }) => [root.id, replies.map(({ id }) => id)]);

  it("behält die Wurzel als Kontext und von den Antworten nur die Treffer", () => {
    expect(shape("treffer")).toEqual([
      ["1", ["2"]],
      ["4", []],
    ]);
  });

  it("lässt ohne Suchbegriff alle Threads unverändert", () => {
    expect(shape("  ")).toEqual([
      ["1", ["2", "3"]],
      ["4", ["5"]],
      ["6", ["7"]],
    ]);
  });
});
