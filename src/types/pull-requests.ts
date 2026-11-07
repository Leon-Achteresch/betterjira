import type { PullRequestCheckFilter } from "@/lib/scm/pull-request-checks";
import type { pullRequestsEmptyText } from "@/lib/scm/pull-request-empty";
import type { PullRequestSort } from "@/lib/scm/pull-request-sort";
import type { ListedPullRequest, PullRequestEmptyReason, PullRequestRepoState, PullRequestStatus } from "@/lib/scm/pull-requests";
import type { SelectOption } from "@/types/select-option";

export type PullRequestsEmptyProps = ReturnType<typeof pullRequestsEmptyText> & { onChecksReset?: () => void };

export type PullRequestListProps = {
  pullRequests: ListedPullRequest[];
  failedRepos: PullRequestRepoState[];
  truncatedRepos: (Pick<PullRequestRepoState, "id" | "repo"> & { browseUrl: string })[];
  waiting: boolean;
  empty: PullRequestEmptyReason | null;
  emptyText: ReturnType<typeof pullRequestsEmptyText>;
  onOpen: (url: string) => void;
  onChecksReset: () => void;
};

export type PullRequestFiltersProps = {
  filter: PullRequestStatus;
  query: string;
  sort: PullRequestSort;
  checks: PullRequestCheckFilter;
  repo: string;
  repoOptions: SelectOption[];
  count: number;
  loading: boolean;
  refreshing: boolean;
  updatedAt: Date | null;
  onQueryChange: (query: string) => void;
  onRepoChange: (repo: string) => void;
  onSortChange: (sort: string) => void;
  onChecksChange: (checks: string) => void;
  onRefresh: () => void;
};
