import { useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Effect } from "effect";
import { scmKeys } from "@/lib/scm/client";
import { providerFor } from "@/lib/scm/provider";
import { DEFAULT_PULL_REQUEST_SORT, pullRequestSortFrom, pullRequestSortParam, type PullRequestSort } from "@/lib/scm/pull-request-sort";
import {
  listStateFor,
  PULL_REQUEST_STATUS_LABELS,
  loadPullRequests,
  pullRequestTargets,
  visiblePullRequests,
  type ListedPullRequest,
  type PullRequestRepoState,
  type PullRequestsSearch,
  type PullRequestStatus,
} from "@/lib/scm/pull-requests";
import { useScmConnections } from "./use-scm-connections";
import { useScmSettings } from "./use-scm-settings";

type PullRequestsPageStatus = "loading" | "unconfigured" | "unlinked" | "ready";

export const usePullRequestsPage = (search: PullRequestsSearch) => {
  const navigate = useNavigate({ from: "/pull-requests" });
  const queryClient = useQueryClient();
  const { connections, gh } = useScmConnections();
  const repoLinks = useScmSettings((state) => state.repoLinks);
  const targets = useMemo(() => pullRequestTargets(repoLinks, connections), [repoLinks, connections]);
  const status: PullRequestStatus = search.status ?? "open";
  const listState = listStateFor(status);
  const sort: PullRequestSort = search.sort ?? DEFAULT_PULL_REQUEST_SORT;
  const selectedRepo = targets.some(({ id }) => id === search.repo) ? search.repo : undefined;
  const selected = selectedRepo ? targets.filter(({ id }) => id === selectedRepo) : targets;

  const queries = useQueries({
    queries: selected.map((target) => ({
      queryKey: scmKeys.pullRequests(target.link.connectionId, target.link.repo, listState),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        Effect.runPromise(loadPullRequests(target.connection!, target.link.repo, listState), { signal }),
      enabled: !!target.connection,
      staleTime: 60_000,
    })),
  });

  const repos: PullRequestRepoState[] = selected.map((target, index) => {
    const query = queries[index];
    const error = target.connection ? (query?.error?.message ?? null) : gh.isPending ? null : "Verbindung nicht verfügbar";
    return {
      id: target.id,
      repo: target.link.repo,
      status: error && !query?.data ? "error" : query?.data ? "ready" : "loading",
      error,
      truncated: query?.data?.truncated ?? false,
      browseUrl: target.connection ? providerFor(target.connection.kind).pullRequestsUrl(target.connection, target.link.repo) : null,
      onRetry: () => (target.connection ? void query?.refetch() : void gh.refetch()),
    };
  });

  const listed: ListedPullRequest[] = selected.flatMap((target, index) =>
    (queries[index]?.data?.pullRequests ?? []).map((pr) => ({ pr, repo: target.link.repo, repoId: target.id })),
  );
  const pullRequests = visiblePullRequests(listed, status, search.q, sort);
  const updatedAt = Math.max(0, ...queries.map((query) => query.dataUpdatedAt));

  const pageStatus: PullRequestsPageStatus =
    gh.isPending && targets.length === 0
      ? "loading"
      : connections.length === 0 && targets.length === 0
        ? "unconfigured"
        : targets.length === 0
          ? "unlinked"
          : "ready";

  const setSearch = (patch: PullRequestsSearch, replace = true) =>
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace });

  return {
    status: pageStatus,
    filter: status,
    query: search.q ?? "",
    sort,
    repo: selectedRepo ?? "",
    repoOptions: targets.map((target) => ({ value: target.id, label: target.link.repo })),
    repos,
    filterLabel: PULL_REQUEST_STATUS_LABELS[status],
    pullRequests,
    loading: pullRequests.length === 0 && repos.some((repo) => repo.status === "loading"),
    refreshing: queries.some((query) => query.isFetching),
    updatedAt: updatedAt > 0 ? new Date(updatedAt) : null,
    onQueryChange: (q: string) => setSearch({ q: q || undefined }),
    onRepoChange: (repo: string) => setSearch({ repo: repo || undefined }),
    onSortChange: (value: string) => {
      const next = pullRequestSortFrom(value);
      if (next && next !== sort) setSearch({ sort: pullRequestSortParam(next) }, false);
    },
    onRefresh: () => void queryClient.invalidateQueries({ queryKey: scmKeys.pullRequestsAll }),
    onOpen: (url: string) => void openUrl(url),
  };
};
