import { createFileRoute } from "@tanstack/react-router";
import { IssueView, IssueViewSkeleton } from "@/components/issue-view";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { SessionGate } from "@/components/shell/session-gate";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { useRememberIssueTab } from "@/hooks/use-issue-tabs";
import { issueRouteSearch, withoutCommentSearch } from "@/lib/jira/issue-link";

export const Route = createFileRoute("/issue/$key")({
  validateSearch: issueRouteSearch,
  component: Issue,
});

function Issue() {
  const { key } = Route.useParams();
  const { bereich, comment } = Route.useSearch();
  const navigate = Route.useNavigate();
  const session = useJiraSession();
  useRememberIssueTab(key);

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-col p-8">
      <SessionGate
        session={session}
        className="flex flex-col"
        pending={<IssueViewSkeleton />}
        unconnected={<LoginPrompt description="Melde dich an, um Tickets zu sehen." />}
      >
        <IssueView
          key={key}
          issueKey={key}
          initialTab={bereich === "zeit" ? "time" : undefined}
          focusComment={comment}
          onFocusHandled={() => void navigate({ search: withoutCommentSearch, replace: true, resetScroll: false })}
        />
      </SessionGate>
    </div>
  );
}
