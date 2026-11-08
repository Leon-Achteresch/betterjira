import { Link, createFileRoute } from "@tanstack/react-router";
import { FolderKanbanIcon, SlidersHorizontalIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { ProjectDirectory } from "@/components/projects/project-directory";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { SessionGate } from "@/components/shell/session-gate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { useProjectDirectory } from "@/hooks/jira/use-project-directory";
import { projectDirectorySearch } from "@/lib/project-directory";

export const Route = createFileRoute("/bereiche/")({
  validateSearch: (search: Record<string, unknown>) => projectDirectorySearch(search),
  component: Bereiche,
});

function Bereiche() {
  const search = Route.useSearch();
  const session = useJiraSession();
  const directory = useProjectDirectory(search);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <FolderKanbanIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-balance">Bereiche</h1>
          <p className="text-sm text-muted-foreground">Alle Jira-Bereiche, auf die du Zugriff hast.</p>
        </div>
        <Tooltip content="Seitenleiste anpassen">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/settings/bereiche" aria-label="Seitenleiste anpassen">
              <SlidersHorizontalIcon />
            </Link>
          </Button>
        </Tooltip>
      </div>
      <SessionGate
        session={session}
        pending={<Skeleton className="h-64 w-full rounded-2xl" />}
        unconnected={<LoginPrompt description="Melde dich an, um deine Bereiche zu sehen." />}
      >
        <ProjectDirectory
          directory={directory}
          query={directory.query}
          view={directory.view}
          sort={directory.sort}
          onSortChange={directory.changeSort}
          onQueryChange={directory.changeQuery}
        />
      </SessionGate>
    </div>
  );
}
