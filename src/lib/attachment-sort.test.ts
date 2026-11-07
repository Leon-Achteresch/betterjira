import { describe, expect, it } from "vitest";
import { isAttachmentSortMode, sortAttachments, type SortableAttachment } from "./attachment-sort";

type Item = SortableAttachment & { id: string };

const ids = (items: readonly Item[]) => items.map((item) => item.id);

const items: Item[] = [
  { id: "a1", filename: "Bericht 10.pdf", created: "2026-11-03T08:00:00.000+0000", size: 2_400_000 },
  { id: "a2", filename: "bericht 2.pdf", created: "2026-11-05T10:00:00.000+0100", size: 512 },
  { id: "a3", filename: "Screenshot.png", created: "kein-datum", size: 48_000 },
  { id: "a4", filename: "", created: "2026-11-01T09:00:00Z", size: 2048 },
  { id: "a5", filename: "Anhang.txt", created: "2026-11-05T09:00:00Z", size: 2048 },
];

describe("sortAttachments", () => {
  it("keeps the original array for the default mode", () => {
    expect(sortAttachments(items, "original")).toBe(items);
  });

  it("sorts names naturally, case-insensitive, with empty names last", () => {
    expect(ids(sortAttachments(items, "name"))).toEqual(["a5", "a2", "a1", "a3", "a4"]);
  });

  it("treats missing and whitespace-only names as unknown", () => {
    const list: Item[] = [{ id: "x" }, { id: "y", filename: "   " }, { id: "z", filename: "b" }];
    expect(ids(sortAttachments(list, "name"))).toEqual(["z", "x", "y"]);
  });

  it("puts the newest first, honours Jira offsets and moves invalid dates last", () => {
    expect(ids(sortAttachments(items, "newest"))).toEqual(["a2", "a5", "a1", "a4", "a3"]);
  });

  it("keeps the original order for equal values", () => {
    const list: Item[] = [
      { id: "1", filename: "a.txt", created: "2026-11-01T00:00:00Z", size: 5 },
      { id: "2", filename: "A.txt", created: "2026-11-01T00:00:00Z", size: 5 },
      { id: "3", filename: "a.TXT", created: "2026-11-01T00:00:00Z", size: 5 },
    ];
    expect(ids(sortAttachments(list, "name"))).toEqual(["1", "2", "3"]);
    expect(ids(sortAttachments(list, "newest"))).toEqual(["1", "2", "3"]);
    expect(ids(sortAttachments(list, "largest"))).toEqual(["1", "2", "3"]);
  });

  it("compares bytes numerically and moves invalid sizes last", () => {
    const list: Item[] = [
      { id: "nine", size: 9 },
      { id: "nan", size: Number.NaN },
      { id: "hundred", size: 100 },
      { id: "missing" },
      { id: "ten", size: 10 },
      { id: "negative", size: -1 },
      { id: "zero", size: 0 },
    ];
    expect(ids(sortAttachments(list, "largest"))).toEqual(["hundred", "ten", "nine", "zero", "nan", "missing", "negative"]);
    expect(ids(sortAttachments(items, "largest"))).toEqual(["a1", "a3", "a4", "a5", "a2"]);
  });

  it("does not mutate the input", () => {
    const copy = [...items];
    sortAttachments(items, "name");
    expect(items).toEqual(copy);
  });

  it("handles empty lists", () => {
    expect(sortAttachments([], "largest")).toEqual([]);
  });
});

describe("isAttachmentSortMode", () => {
  it("accepts known modes only", () => {
    expect(isAttachmentSortMode("newest")).toBe(true);
    expect(isAttachmentSortMode("oldest")).toBe(false);
    expect(isAttachmentSortMode("")).toBe(false);
  });
});
