import { describe, expect, it, vi } from "vitest";
import { loadRemainingSearch, searchContinuation, uniqueSearchIssues, type SearchData } from "./search-loading";
import type { SearchPage } from "./search";

const issue = (id: string, key = `DEMO-${id}`) => ({ id, key, fields: { summary: `Ticket ${id}` } });
const page = (ids: string[], next?: string, isLast = !next): SearchPage => ({ issues: ids.map((id) => issue(id)), nextPageToken: next, isLast });

describe("kontrolliertes Nachladen bestehender Suchseiten", () => {
  it("laedt sequentiell bis Jira-Ende und zeigt doppelte IDs/Keys nur einmal", async () => {
    let data: SearchData = { pages: [page(["1"], "a")], pageParams: [undefined] };
    const next = vi.fn(async () => { data = { pages: [...data.pages, next.mock.calls.length === 1 ? page(["1", "2"], "b") : page(["3"])], pageParams: [...data.pageParams, next.mock.calls.length === 1 ? "a" : "b"] }; });
    const progress = vi.fn();
    const result = await loadRemainingSearch({ read: () => data, next, signal: new AbortController().signal, isCurrent: () => true, pageSize: 50, onProgress: progress });
    expect(result).toEqual({ loaded: 3, duplicates: 1, pages: 2, reason: "end" });
    expect(progress).toHaveBeenCalledTimes(2);
    expect(uniqueSearchIssues([page(["1"]), { issues: [issue("1", "MOVED-1"), issue("2", "DEMO-1")] }])).toHaveLength(1);
  });
  it("bricht vor der naechsten Seite an der Eintragsgrenze ab, ohne eine Seite abzuschneiden", async () => {
    const data: SearchData = { pages: [page(Array.from({ length: 1980 }, (_, i) => String(i)), "next")], pageParams: [undefined] };
    const next = vi.fn();
    expect((await loadRemainingSearch({ read: () => data, next, signal: new AbortController().signal, isCurrent: () => true, pageSize: 50, onProgress: vi.fn() })).reason).toBe("limit");
    expect(next).not.toHaveBeenCalled();
  });
  it("begrenzt auch leere fortgesetzte Seiten auf 40 weitere Reads", async () => {
    let data: SearchData = { pages: [page([], "0")], pageParams: [undefined] };
    const next = vi.fn(async () => { const token = String(data.pages.length - 1); data = { pages: [...data.pages, page([], String(data.pages.length))], pageParams: [...data.pageParams, token] }; });
    expect(await loadRemainingSearch({ read: () => data, next, signal: new AbortController().signal, isCurrent: () => true, pageSize: 50, onProgress: vi.fn() })).toMatchObject({ pages: 40, reason: "limit" });
    expect(next).toHaveBeenCalledTimes(40);
  });
  it.each(["cycle", "missing"])("nennt einen %s-Cursor keinen bestaetigten Abschluss", (kind) => {
    expect(searchContinuation({ pages: [page(["1"], kind === "cycle" ? "a" : undefined, false)], pageParams: ["a"] }).kind).toBe("cursor");
  });
  it("behaelt bei Readfehler den bisherigen Teilstand", async () => {
    const data: SearchData = { pages: [page(["1"], "a")], pageParams: [undefined] };
    expect(await loadRemainingSearch({ read: () => data, next: async () => { throw new Error("403"); }, signal: new AbortController().signal, isCurrent: () => true, pageSize: 50, onProgress: vi.fn() })).toMatchObject({ reason: "error", loaded: 1, pages: 0 });
  });
  it.each(["cancelled", "changed"])("stoppt %s nach erster Seite ohne weitere Reads", async (reason) => {
    const abort = new AbortController(); let current = true;
    let data: SearchData = { pages: [page(["1"], "a")], pageParams: [undefined] };
    const next = vi.fn(async () => { data = { pages: [...data.pages, page(["2"], "b")], pageParams: [...data.pageParams, "a"] }; if (reason === "cancelled") abort.abort(); else current = false; });
    expect((await loadRemainingSearch({ read: () => data, next, signal: abort.signal, isCurrent: () => current, pageSize: 50, onProgress: vi.fn() })).reason).toBe(reason);
    expect(next).toHaveBeenCalledOnce();
  });
  it("beendet bei zwischenzeitlichem Cacheersatz statt Seiten zu vermischen", async () => {
    let data: SearchData = { pages: [page(["1"], "a")], pageParams: [undefined] };
    expect((await loadRemainingSearch({ read: () => data, next: async () => { data = { pages: [page(["new"])], pageParams: [undefined] }; }, signal: new AbortController().signal, isCurrent: () => true, pageSize: 50, onProgress: vi.fn() })).reason).toBe("changed");
  });
});
