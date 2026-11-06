import { createFileRoute } from "@tanstack/react-router";
import { IssueTable } from "@/components/issue-table";
import { FilterHeader } from "@/components/issues/filter-header";
import { FilterJqlPanel } from "@/components/issues/filter-jql-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilterEditor } from "@/hooks/use-filter-editor";
import { useJiraSite } from "@/lib/jira/queries";
import { LoginPrompt } from "@/components/shell/login-prompt";

export const Route = createFileRoute("/filter/$id")({
  component: Filter,
});

function Filter() {
  const { id } = Route.useParams();
  const site = useJiraSite();
  const editor = useFilterEditor(id);

  if (!site.isPending && !site.data) {
    return <div className="p-8"><LoginPrompt description="Melde dich an, um Filter zu sehen." /></div>;
  }
  return (
    <div className="flex flex-col gap-6 p-8">
      <FilterHeader id={id} editor={editor} />
      <FilterJqlPanel editor={editor} />
      {editor.tableJql ? (
        <IssueTable key={id} scope={`filter:${id}`} jql={editor.tableJql} onAdoptJql={editor.adopt} />
      ) : (
        <Skeleton className="h-64 w-full" />
      )}
    </div>
  );
}
