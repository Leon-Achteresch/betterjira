import { createFileRoute } from "@tanstack/react-router";
import { IssueView } from "@/components/issue-view";
import { useIssueTabStore } from "@/hooks/use-issue-tabs";
import { parseCommentSearch } from "@/lib/jira/issue-link";
import { useJiraSite } from "@/lib/jira/queries";
import { LoginPrompt } from "@/components/shell/login-prompt";

export const Route = createFileRoute("/issue/$key")({
  validateSearch: parseCommentSearch,
  onEnter: ({ params }) => useIssueTabStore.getState().open(params.key),
  component: Issue,
});

function Issue() {
  const { key } = Route.useParams();
  const { comment } = Route.useSearch();
  const navigate = Route.useNavigate();
  const site = useJiraSite();

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-col p-8">
      {!site.isPending && !site.data ? (
        <LoginPrompt description="Melde dich an, um Tickets zu sehen." />
      ) : (
        <IssueView
          key={key}
          issueKey={key}
          focusComment={comment}
          onFocusHandled={() => void navigate({ search: {}, replace: true, resetScroll: false })}
        />
      )}
    </div>
  );
}
