import { Semaphore } from "effect";
import { repoLinkId } from "./development";
import type { PullRequest, PullRequestListState, PullRequestState, RepoLink, ScmConnection } from "./model";
import { providerFor } from "./provider";

export const PULL_REQUEST_STATUSES = ["open", "draft", "merged", "closed"] as const satisfies readonly PullRequestState[];
export type PullRequestStatus = (typeof PULL_REQUEST_STATUSES)[number];

export const PULL_REQUEST_STATUS_LABELS: Record<PullRequestStatus, string> = {
  open: "Offen",
  draft: "Entwurf",
  merged: "Gemergt",
  closed: "Geschlossen",
};

export type PullRequestsSearch = { status?: PullRequestStatus; q?: string; repo?: string };

const MAX_SEARCH_LENGTH = 200;

const text = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.slice(0, max) : undefined);

export const pullRequestsSearch = (raw: Record<string, unknown>): PullRequestsSearch => ({
  status: PULL_REQUEST_STATUSES.find((status) => status === raw.status && status !== "open"),
  q: text(raw.q, MAX_SEARCH_LENGTH),
  repo: text(raw.repo, MAX_SEARCH_LENGTH * 2),
});

export const listStateFor = (status: PullRequestStatus): PullRequestListState => (status === "draft" ? "open" : status);

export type PullRequestTarget = { id: string; link: RepoLink; connection: ScmConnection | null };

export const pullRequestTargets = (repoLinks: Record<string, readonly RepoLink[]>, connections: readonly ScmConnection[]) => {
  const targets = new Map<string, PullRequestTarget>();
  for (const link of Object.values(repoLinks).flat()) {
    const id = repoLinkId(link);
    if (!targets.has(id)) targets.set(id, { id, link, connection: connections.find(({ id }) => id === link.connectionId) ?? null });
  }
  return [...targets.values()].sort((a, b) => a.link.repo.localeCompare(b.link.repo));
};

const LIST_SLOTS = Semaphore.makeUnsafe(4);

export const loadPullRequests = (connection: ScmConnection, repo: string, state: PullRequestListState) =>
  Semaphore.withPermits(LIST_SLOTS, 1)(providerFor(connection.kind).pullRequests(connection, repo, state));

export type PullRequestRepoState = {
  id: string;
  repo: string;
  status: "loading" | "error" | "ready";
  error: string | null;
  truncated: boolean;
  browseUrl: string | null;
  onRetry: () => void;
};

export type ListedPullRequest = { pr: PullRequest; repo: string; repoId: string };

const matchesQuery = ({ pr, repo }: ListedPullRequest, query: string) =>
  [pr.title, `#${pr.number}`, pr.source, pr.target, pr.author?.name ?? "", repo].some((value) => value.toLowerCase().includes(query));

export const visiblePullRequests = (listed: readonly ListedPullRequest[], status: PullRequestStatus, query: string | undefined) => {
  const needle = query?.trim().toLowerCase() ?? "";
  return listed
    .filter((entry) => entry.pr.state === status && (!needle || matchesQuery(entry, needle)))
    .sort((a, b) => b.pr.updatedAt.localeCompare(a.pr.updatedAt));
};
