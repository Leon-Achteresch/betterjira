import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { IssueTable } from "@/components/issue-table";
import { FilterHeader } from "@/components/issues/filter-header";
import { FilterJqlPanel } from "@/components/issues/filter-jql-panel";
import { FilterLoadError, FilterRefreshNotice, FilterSkeleton } from "@/components/issues/filter-states";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { SessionGate } from "@/components/shell/session-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { useFilterEditor } from "@/hooks/use-filter-editor";

export const Route = createFileRoute("/filter/$id")({
  component: Filter,
});

function Filter() {
  const { id } = Route.useParams();
  const session = useJiraSession();
  const editor = useFilterEditor(id);

  return (
    <SessionGate
      session={session}
      className="flex flex-col gap-6 p-4 sm:p-8"
      pending={<FilterSkeleton />}
      unconnected={<LoginPrompt description="Melde dich an, um Filter zu sehen." />}
    >
      <FilterHeader key={id} id={id} editor={editor} />
      <AnimatePresence initial={false}>
        {editor.refreshFailed && <FilterRefreshNotice key="refresh" retrying={editor.retrying} onRetry={editor.retry} />}
      </AnimatePresence>
      {editor.loadError ? (
        <FilterLoadError {...editor.loadError} retrying={editor.retrying} onRetry={editor.retry} />
      ) : (
        <>
          <FilterJqlPanel key={id} editor={editor} />
          {editor.tableJql ? (
            <IssueTable key={id} scope={`filter:${id}`} jql={editor.tableJql} onAdoptJql={editor.adopt} />
          ) : (
            <Skeleton className="h-64 w-full rounded-2xl" />
          )}
        </>
      )}
    </SessionGate>
  );
}
