import type { InfiniteData } from "@tanstack/react-query";

export const mergeIssuePages = <Issue extends { key: string }, Page extends { issues: readonly Issue[] }>(
  current: InfiniteData<Page>, keys: readonly string[], refreshed: readonly Issue[],
): InfiniteData<Page> => {
  const byKey = new Map(refreshed.map((issue) => [issue.key, issue]));
  const changed = new Set(keys);
  const seen = new Set<string>();
  const pages = current.pages.map((page) => ({ ...page, issues: page.issues.flatMap((issue) => {
    if (seen.has(issue.key)) return [];
    seen.add(issue.key);
    if (!changed.has(issue.key)) return [issue];
    const next = byKey.get(issue.key);
    return next ? [next] : [];
  }) }));
  const added = refreshed.filter((issue) => !seen.has(issue.key));
  if (pages[0] && added.length) pages[0] = { ...pages[0], issues: [...pages[0].issues, ...added] };
  return { ...current, pages };
};
