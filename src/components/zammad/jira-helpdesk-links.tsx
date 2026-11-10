import { Link } from "@tanstack/react-router";
import { ZammadLogo } from "@/components/brands/service-logos";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { JiraHelpdeskReference } from "@/hooks/zammad/use-jira-helpdesk";

export function JiraHelpdeskLinks({
  references,
}: {
  references: readonly JiraHelpdeskReference[];
}) {
  if (!references.length) return null;
  return (
    <section aria-label="Helpdesk-Tickets" className="flex flex-col gap-3">
      <h2 className="text-xs font-medium text-muted-foreground">
        Zammad-Tickets
      </h2>
      {references.map((reference) => (
        <div key={reference.key} className="rounded-2xl border p-4">
          <div className="flex items-center gap-3">
            <ZammadLogo aria-hidden className="size-7 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground tabular-nums">
                Zammad{reference.number && ` · #${reference.number}`}
              </p>
              {reference.loading ? (
                <Skeleton className="mt-2 h-4 w-48" />
              ) : reference.id ? (
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Link
                      to="/helpdesk/$id"
                      params={{ id: String(reference.id) }}
                      onMouseEnter={reference.onPrefetch}
                      onFocus={reference.onPrefetch}
                      className="mt-1 block truncate text-sm font-medium hover:underline"
                    >
                      {reference.title}
                    </Link>
                  </HoverCardTrigger>
                  <HoverCardContent className="space-y-2 p-4">
                    <p className="font-medium">{reference.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {reference.state} · {reference.customer}
                    </p>
                  </HoverCardContent>
                </HoverCard>
              ) : (
                <p className="mt-1 text-sm">{reference.title}</p>
              )}
            </div>
            {reference.id ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/helpdesk/$id" params={{ id: String(reference.id) }}>
                  Öffnen
                </Link>
              </Button>
            ) : (
              !reference.connected && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/settings/verbindungen">Verbinden</Link>
                </Button>
              )
            )}
          </div>
          {reference.error && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p role="alert" className="text-xs text-destructive">
                {reference.error}
              </p>
              <Button variant="ghost" size="sm" onClick={reference.onRetry}>
                Erneut versuchen
              </Button>
            </div>
          )}
          {reference.connected &&
            !reference.loading &&
            !reference.id &&
            !reference.error && (
              <p className="mt-2 text-xs text-muted-foreground">
                Dieser Verweis enthält keine auflösbare Zammad-Ticketnummer.
                Prüfe das Helpdesk-Feld in Jira.
              </p>
            )}
        </div>
      ))}
    </section>
  );
}
