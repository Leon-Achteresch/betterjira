import { createFileRoute } from "@tanstack/react-router";
import { BriefcaseIcon } from "lucide-react";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { SessionGate } from "@/components/shell/session-gate";
import { WorkspaceOverview } from "@/components/workspace/workspace-overview";
import { Skeleton } from "@/components/ui/skeleton";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { useWorkspacePage } from "@/hooks/use-workspace-page";
import { parseWorkspacePageSearch } from "@/lib/workspace-page";

export const Route = createFileRoute("/arbeitsplatz")({
  validateSearch: parseWorkspacePageSearch,
  component: Arbeitsplatz,
});

function Arbeitsplatz() {
  const session = useJiraSession();
  const page = useWorkspacePage(Route.useSearch());
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <BriefcaseIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-balance">Arbeitsplatz</h1>
          <p className="text-sm text-muted-foreground">Angefangene Arbeit an einem Ort: Pins, Entwürfe, Notizen und Verlauf.</p>
        </div>
      </div>
      <SessionGate
        session={session}
        pending={<Skeleton className="h-64 w-full rounded-2xl" />}
        unconnected={<LoginPrompt description="Melde dich an, um deine Arbeitskontexte zu sehen." />}
      >
        <WorkspaceOverview
          ready={page.ready}
          filter={page.filter}
          query={page.query}
          sort={page.sort}
          total={page.total}
          counts={page.counts}
          entries={page.entries}
          emptyState={page.emptyState}
          recentLimit={page.recentLimit}
          entryRef={page.entryRef}
          searchRef={page.searchRef}
          searchFor={page.searchFor}
          onQueryChange={page.changeQuery}
          onSortChange={page.changeSort}
          onTogglePin={page.togglePin}
          onRemoveRecent={page.removeRecent}
        />
      </SessionGate>
    </div>
  );
}
