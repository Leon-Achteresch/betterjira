import { describe, expect, it } from "vitest";
import { ATTACHMENT_PREVIEW_LIMIT, attachmentPreview } from "./attachment-preview";

const file = (filename: string, created?: string) => ({ filename, created });

describe("attachmentPreview", () => {
  it("zeigt alle Anhänge, solange die Grenze nicht überschritten ist", () => {
    const files = Array.from({ length: ATTACHMENT_PREVIEW_LIMIT }, (_, index) => file(`datei-${index}.txt`));
    expect(attachmentPreview(files)).toEqual({ shown: files, hidden: 0 });
  });

  it("zeigt die neuesten zuerst und zählt den Rest", () => {
    const files = [
      file("alt.txt", "2026-11-01T09:00:00.000+0100"),
      file("neu.txt", "2026-11-05T09:00:00.000+0100"),
      file("mitte.txt", "2026-11-03T09:00:00.000+0100"),
    ];
    const preview = attachmentPreview(files, 2);
    expect(preview.shown.map((entry) => entry.filename)).toEqual(["neu.txt", "mitte.txt"]);
    expect(preview.hidden).toBe(1);
  });

  it("behält bei gleichem oder fehlendem Datum die ursprüngliche Reihenfolge", () => {
    const files = [file("a.txt"), file("b.txt", "kein-datum"), file("c.txt")];
    expect(attachmentPreview(files).shown).toEqual(files);
  });

  it("kommt mit einer leeren Liste zurecht", () => {
    expect(attachmentPreview([])).toEqual({ shown: [], hidden: 0 });
  });
});
