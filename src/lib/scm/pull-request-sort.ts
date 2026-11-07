import type { ListedPullRequest } from "./pull-requests";

export const PULL_REQUEST_SORTS = ["updated", "updated-asc", "title", "repo"] as const;
export type PullRequestSort = (typeof PULL_REQUEST_SORTS)[number];

export const DEFAULT_PULL_REQUEST_SORT: PullRequestSort = "updated";

export const PULL_REQUEST_SORT_LABELS: Record<PullRequestSort, string> = {
  updated: "Zuletzt aktualisiert",
  "updated-asc": "Älteste Aktualisierung zuerst",
  title: "Titel A–Z",
  repo: "Repository",
};

export const pullRequestSortFrom = (value: unknown): PullRequestSort | undefined => PULL_REQUEST_SORTS.find((sort) => sort === value);

export const pullRequestSortParam = (value: unknown): PullRequestSort | undefined => {
  const sort = pullRequestSortFrom(value);
  return sort === DEFAULT_PULL_REQUEST_SORT ? undefined : sort;
};

const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

const timeOf = (value: string) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

type Compare = (a: ListedPullRequest, b: ListedPullRequest) => number;

const byTime =
  (direction: 1 | -1): Compare =>
  (a, b) => {
    const left = timeOf(a.pr.updatedAt);
    const right = timeOf(b.pr.updatedAt);
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
    return (left - right) * direction;
  };

const newestFirst = byTime(-1);

const COMPARE: Record<PullRequestSort, Compare> = {
  updated: newestFirst,
  "updated-asc": byTime(1),
  title: (a, b) => collator.compare(a.pr.title, b.pr.title),
  repo: (a, b) => collator.compare(a.repo, b.repo) || newestFirst(a, b),
};

export const sortPullRequests = (entries: readonly ListedPullRequest[], sort: PullRequestSort) => [...entries].sort(COMPARE[sort]);
