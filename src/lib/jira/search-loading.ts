import type { InfiniteData } from "@tanstack/react-query";
import type { SearchPage } from "./search";

export const SEARCH_LOAD_MAX_ENTRIES = 2000;
export const SEARCH_LOAD_MAX_PAGES = 40;
export type SearchData = InfiniteData<SearchPage>;
export type SearchLoadReason = "end" | "limit" | "cancelled" | "error" | "changed" | "cursor";
export type SearchLoadProgress = { loaded: number; duplicates: number; pages: number };
export type SearchLoadResult = SearchLoadProgress & { reason: SearchLoadReason };

export const uniqueSearchIssues = (pages: readonly SearchPage[]) => {
  const ids = new Set<string>();
  const keys = new Set<string>();
  return pages.flatMap((page) => page.issues).filter((issue) => {
    if (ids.has(issue.id) || keys.has(issue.key)) return false;
    ids.add(issue.id); keys.add(issue.key); return true;
  });
};

export const searchContinuation = (data: SearchData): { kind: "more"; token: string } | { kind: "end" | "cursor" } => {
  const last = data.pages.at(-1);
  if (!last) return { kind: "cursor" };
  if (last.isLast) return { kind: "end" };
  const token = last.nextPageToken;
  if (!token) return { kind: last.isLast === false ? "cursor" : "end" };
  return data.pageParams.includes(token) ? { kind: "cursor" } : { kind: "more", token };
};

export const searchLoadProgress = (data: SearchData | undefined, pages: number): SearchLoadProgress => {
  const loaded = uniqueSearchIssues(data?.pages ?? []).length;
  return { loaded, pages, duplicates: (data?.pages.reduce((sum, page) => sum + page.issues.length, 0) ?? 0) - loaded };
};

export async function loadRemainingSearch(options: {
  read: () => SearchData | undefined;
  next: () => Promise<unknown>;
  isCurrent: () => boolean;
  signal: AbortSignal;
  pageSize: number;
  onProgress: (progress: SearchLoadProgress) => void;
}): Promise<SearchLoadResult> {
  let pages = 0;
  const result = (reason: SearchLoadReason) => ({ ...searchLoadProgress(options.read(), pages), reason });
  while (true) {
    if (options.signal.aborted) return result("cancelled");
    if (!options.isCurrent()) return result("changed");
    const before = options.read();
    if (!before) return result("changed");
    const continuation = searchContinuation(before);
    if (continuation.kind !== "more") return result(continuation.kind);
    const entries = before.pages.reduce((sum, page) => sum + page.issues.length, 0);
    if (pages >= SEARCH_LOAD_MAX_PAGES || entries + options.pageSize > SEARCH_LOAD_MAX_ENTRIES) return result("limit");
    try { await options.next(); } catch { return result(options.signal.aborted ? "cancelled" : !options.isCurrent() ? "changed" : "error"); }
    if (options.signal.aborted) return result("cancelled");
    if (!options.isCurrent()) return result("changed");
    const after = options.read();
    if (!after || after.pages.length !== before.pages.length + 1 || before.pages.some((page, index) => after.pages[index] !== page)) return result("changed");
    pages++;
    options.onProgress(searchLoadProgress(after, pages));
  }
}
