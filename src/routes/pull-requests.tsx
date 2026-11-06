import { createFileRoute } from "@tanstack/react-router";
import { GitPullRequestIcon } from "lucide-react";
import { PullRequestFilters } from "@/components/pull-requests/pull-request-filters";
import { PullRequestList } from "@/components/pull-requests/pull-request-list";
import { PullRequestsSetup } from "@/components/pull-requests/pull-requests-setup";
import { Skeleton } from "@/components/ui/skeleton";
import { usePullRequestsPage } from "@/hooks/scm/use-pull-requests-page";
import { pullRequestsSearch } from "@/lib/scm/pull-requests";

export const Route = createFileRoute("/pull-requests")({
  validateSearch: pullRequestsSearch,
  component: PullRequests,
});

function PullRequests() {
  const page = usePullRequestsPage(Route.useSearch());

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <GitPullRequestIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-balance">Pull Requests</h1>
          <p className="text-sm text-muted-foreground">Alle Pull Requests aus deinen verknüpften Repositories.</p>
        </div>
      </div>
      {page.status === "loading" ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : page.status === "unconfigured" || page.status === "unlinked" ? (
        <PullRequestsSetup reason={page.status} />
      ) : (
        <>
          <PullRequestFilters
            filter={page.filter}
            query={page.query}
            repo={page.repo}
            repoOptions={page.repoOptions}
            count={page.pullRequests.length}
            loading={page.loading}
            refreshing={page.refreshing}
            updatedAt={page.updatedAt}
            onQueryChange={page.onQueryChange}
            onRepoChange={page.onRepoChange}
            onRefresh={page.onRefresh}
          />
          <PullRequestList
            pullRequests={page.pullRequests}
            repos={page.repos}
            filterLabel={page.filterLabel}
            query={page.query}
            onOpen={page.onOpen}
          />
        </>
      )}
    </div>
  );
}
