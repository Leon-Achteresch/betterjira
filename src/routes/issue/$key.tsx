import { createFileRoute } from "@tanstack/react-router";
import { IssueView } from "@/components/issue-view";
import { useJiraSite } from "@/lib/jira/queries";

export const Route = createFileRoute("/issue/$key")({
  component: Issue,
});

function Issue() {
  const { key } = Route.useParams();
  const site = useJiraSite();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col p-8">
      {!site.isPending && !site.data ? (
        <p className="text-muted-foreground">Melde dich auf der Startseite an, um Tickets zu sehen.</p>
      ) : (
        <IssueView key={key} issueKey={key} />
      )}
    </div>
  );
}
