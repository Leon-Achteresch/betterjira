import { createFileRoute } from "@tanstack/react-router";
import { SquarePenIcon } from "lucide-react";
import { CreateIssueForm } from "@/components/create-issue/create-issue-form";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { SessionGate } from "@/components/shell/session-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateIssueForm } from "@/hooks/jira/use-create-issue-form";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { createRouteSearch } from "@/lib/jira/create-issue-parent";

export const Route = createFileRoute("/neu")({
  validateSearch: createRouteSearch,
  component: NewIssue,
});

function NewIssue() {
  const { parent } = Route.useSearch();
  const session = useJiraSession();
  const form = useCreateIssueForm(parent);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <SquarePenIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-balance">{parent ? "Unteraufgabe erstellen" : "Ticket erstellen"}</h1>
          <p className="text-sm text-muted-foreground">{parent ? `Neue Unteraufgabe für ${parent}.` : "Neues Jira-Ticket mit den Pflichtangaben des gewählten Typs."}</p>
        </div>
      </div>
      <SessionGate
        session={session}
        pending={<Skeleton className="h-80 w-full rounded-2xl" />}
        unconnected={<LoginPrompt description="Melde dich an, um Tickets zu erstellen." />}
      >
        <CreateIssueForm form={form} />
      </SessionGate>
    </div>
  );
}
