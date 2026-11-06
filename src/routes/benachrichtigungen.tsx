import { createFileRoute } from "@tanstack/react-router";
import { BellIcon } from "lucide-react";
import { NotificationInbox } from "@/components/notifications/notification-inbox";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { SessionGate } from "@/components/shell/session-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { useNotificationInbox } from "@/hooks/notifications/use-notification-inbox";
import { inboxSearchOf } from "@/lib/jira/notification-feed";

export const Route = createFileRoute("/benachrichtigungen")({
  validateSearch: inboxSearchOf,
  component: Benachrichtigungen,
});

function Benachrichtigungen() {
  const session = useJiraSession();
  const inbox = useNotificationInbox();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <BellIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-balance">Benachrichtigungen</h1>
          <p className="text-sm text-muted-foreground">Aktivität zu deinen und beobachteten Tickets, nach Tag und Ticket gruppiert.</p>
        </div>
      </div>
      <SessionGate
        session={session}
        pending={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-full max-w-xl rounded-xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        }
        unconnected={<LoginPrompt description="Melde dich an, um die lokal erfassten Benachrichtigungen deines Jira-Kontos zu sehen." />}
      >
        <NotificationInbox {...inbox} />
      </SessionGate>
    </div>
  );
}
