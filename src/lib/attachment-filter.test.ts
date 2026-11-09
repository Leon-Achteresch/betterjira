import { describe, expect, it } from "vitest";
import { attachmentKind, attachmentName, filterAttachments } from "./attachment-filter";

const files = [
  { id: "1", filename: "Screenshot Übergabe.PNG", mimeType: "image/png" },
  { id: "2", filename: "Angebot (final) [v2].pdf", mimeType: "application/pdf" },
  { id: "3", filename: "notizen.txt", mimeType: "text/plain; charset=utf-8" },
  { id: "4", filename: "bericht.pdf", mimeType: "application/octet-stream" },
  { id: "5", filename: "  ", mimeType: "" },
  { id: "6", filename: "Tabelle.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
];

const ids = (query: string, kind: Parameters<typeof filterAttachments>[1]["kind"] = "all") =>
  filterAttachments(files, { query, kind }).map((file) => file.id);

describe("attachment filter", () => {
  it("sucht ohne Groß-/Kleinschreibung im Dateinamen und ignoriert Leerraum", () => {
    expect(ids("  übergabe ")).toEqual(["1"]);
    expect(ids("")).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("behandelt Sonderzeichen wörtlich statt als Muster", () => {
    expect(ids("(final) [v2]")).toEqual(["2"]);
    expect(ids(".*")).toEqual([]);
  });

  it("gruppiert nach MIME-Typ, nicht nach Dateiendung", () => {
    expect(ids("", "image")).toEqual(["1"]);
    expect(ids("", "document")).toEqual(["2", "3", "6"]);
    expect(ids("", "other")).toEqual(["4", "5"]);
    expect(attachmentKind("IMAGE/SVG+XML")).toBe("image");
    expect(attachmentKind("application/x-unbekannt")).toBe("other");
  });

  it("zeigt fehlende Dateinamen neutral an und findet sie über diesen Namen", () => {
    expect(attachmentName("   ")).toBe("Unbenannte Datei");
    expect(ids("unbenannt")).toEqual(["5"]);
    expect(ids("pdf", "other")).toEqual(["4"]);
  });
});
