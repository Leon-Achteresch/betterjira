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
  validateSearch: (search: Record<string, unknown>): { abfrage?: true } => search.abfrage === true ? { abfrage: true } : {},
  component: Filter,
});

function Filter() {
  const { id } = Route.useParams();
  const session = useJiraSession();
  const { abfrage } = Route.useSearch();
  const editor = useFilterEditor(id, abfrage);

  return (
    <SessionGate
      session={session}
      className="flex flex-col gap-6 p-4 sm:p-8"
      pending={<FilterSkeleton />}
      unconnected={<LoginPrompt description="Melde dich an, um Filter zu sehen." />}
    >
      <FilterHeader key={editor.context} id={id} editor={editor} />
      <AnimatePresence initial={false}>
        {editor.refreshFailed && <FilterRefreshNotice key="refresh" retrying={editor.retrying} onRetry={editor.retry} />}
      </AnimatePresence>
      {editor.loadError ? (
        <FilterLoadError {...editor.loadError} retrying={editor.retrying} onRetry={editor.retry} />
      ) : (
        <>
          <FilterJqlPanel key={editor.context} editor={editor} />
          {editor.tableJql ? (
            <IssueTable key={editor.context} scope={`filter:${id}`} jql={editor.tableJql} onAdoptJql={editor.adopt} />
          ) : !editor.filter && (
            <Skeleton className="h-64 w-full rounded-2xl" />
          )}
        </>
      )}
    </SessionGate>
  );
}
