import { createFileRoute } from "@tanstack/react-router";
import { IssueView, IssueViewSkeleton } from "@/components/issue-view";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { SessionGate } from "@/components/shell/session-gate";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { useIssueTabStore } from "@/hooks/use-issue-tabs";

export const Route = createFileRoute("/issue/$key")({
  validateSearch: (search: Record<string, unknown>): { bereich?: "zeit" } => (search.bereich === "zeit" ? { bereich: "zeit" } : {}),
  onEnter: ({ params }) => useIssueTabStore.getState().open(params.key),
  component: Issue,
});

function Issue() {
  const { key } = Route.useParams();
  const { bereich } = Route.useSearch();
  const session = useJiraSession();

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-col p-8">
      <SessionGate
        session={session}
        className="flex flex-col"
        pending={<IssueViewSkeleton />}
        unconnected={<LoginPrompt description="Melde dich an, um Tickets zu sehen." />}
      >
        <IssueView key={key} issueKey={key} initialTab={bereich === "zeit" ? "time" : undefined} />
      </SessionGate>
    </div>
  );
}
