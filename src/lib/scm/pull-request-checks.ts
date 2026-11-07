import type { CheckState } from "./model";

export const PULL_REQUEST_CHECK_FILTERS = ["all", "failure", "pending", "success", "unknown"] as const;
export type PullRequestCheckFilter = (typeof PULL_REQUEST_CHECK_FILTERS)[number];

export const DEFAULT_PULL_REQUEST_CHECK_FILTER: PullRequestCheckFilter = "all";

export const PULL_REQUEST_CHECK_FILTER_LABELS: Record<PullRequestCheckFilter, string> = {
  all: "Alle Prüfstatus",
  failure: "Fehlgeschlagen",
  pending: "Ausstehend",
  success: "Erfolgreich",
  unknown: "Keine Angabe",
};

export const pullRequestCheckFilterFrom = (value: unknown): PullRequestCheckFilter | undefined =>
  PULL_REQUEST_CHECK_FILTERS.find((filter) => filter === value);

export const pullRequestCheckFilterParam = (value: unknown): PullRequestCheckFilter | undefined => {
  const filter = pullRequestCheckFilterFrom(value);
  return filter === DEFAULT_PULL_REQUEST_CHECK_FILTER ? undefined : filter;
};

export const matchesCheckFilter = (checks: CheckState | null, filter: PullRequestCheckFilter) =>
  filter === "all" || (filter === "unknown" ? checks === null : checks === filter);
