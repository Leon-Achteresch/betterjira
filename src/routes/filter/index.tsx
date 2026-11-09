import { createFileRoute } from "@tanstack/react-router";
import { FunnelIcon } from "lucide-react";
import { FilterOverview } from "@/components/filters/filter-overview";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { SessionGate } from "@/components/shell/session-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { useFilterOverview } from "@/hooks/use-filter-overview";
import { parseFilterOverviewSearch } from "@/lib/filter-overview";

export const Route = createFileRoute("/filter/")({
  validateSearch: parseFilterOverviewSearch,
  component: FilterOverviewPage,
});

function FilterOverviewPage() {
  const session = useJiraSession();
  const overview = useFilterOverview(Route.useSearch());
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <FunnelIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-balance">Filter</h1>
          <p className="text-sm text-muted-foreground">Deine eigenen und favorisierten Jira-Filter an einem Ort.</p>
        </div>
      </div>
      <SessionGate
        session={session}
        pending={<Skeleton className="h-64 w-full rounded-2xl" />}
        unconnected={<LoginPrompt description="Melde dich an, um deine Filter zu sehen." />}
      >
        <FilterOverview
          status={overview.status}
          view={overview.view}
          query={overview.query}
          counts={overview.counts}
          filters={overview.filters}
          pendingIds={overview.pendingIds}
          errorText={overview.errorText}
          retrying={overview.retrying}
          emptyState={overview.emptyState}
          searchFor={overview.searchFor}
          onQueryChange={overview.changeQuery}
          onRetry={overview.retry}
          onToggleFavourite={overview.toggleFavourite}
        />
      </SessionGate>
    </div>
  );
}
