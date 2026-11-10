import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDownIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { JiraStatusBadge } from "@/components/jira-status-badge";
import { IssuePreviewTooltip } from "@/components/issues/issue-preview";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useVisibleItems } from "@/hooks/use-visible-items";
import { EASE_OUT } from "@/lib/ease";
import type { IssueLinkGroup, IssueLinkSummary, LinkedIssueRow } from "@/lib/jira/issue-links";
import { jiraErrors } from "@/lib/jira/field-values";
import { cn } from "@/lib/utils";

const GROUP_LIMIT = 5;

type IssueLinksPanelProps = {
  summary?: IssueLinkSummary;
  error: unknown;
  refreshError: unknown;
  retrying: boolean;
  onRetry: () => void;
};

const detailOf = (error: unknown) => jiraErrors(error).messages.join(" ");

function RetryButton({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <Button variant="outline" onClick={onRetry} disabled={retrying}>
      {retrying && <Spinner aria-hidden />}
      Erneut versuchen
    </Button>
  );
}

function LinkedIssue({ issue }: { issue: LinkedIssueRow }) {
  return (
    <IssuePreviewTooltip issueKey={issue.key}>
      <Link
        to="/issue/$key"
        params={{ key: issue.key }}
        data-row-link
        className="grid min-h-9 grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="truncate font-mono text-xs text-muted-foreground">{issue.key}</span>
        <span className="flex min-w-0 items-center gap-2">
          {issue.issuetype?.iconUrl && (
            <img src={issue.issuetype.iconUrl} alt={issue.issuetype.name} title={issue.issuetype.name} className="size-4 shrink-0" />
          )}
          {issue.summary ? (
            <span className="truncate">{issue.summary}</span>
          ) : (
            <span className="truncate text-muted-foreground">Details nicht verfügbar</span>
          )}
          {issue.issuetype && !issue.issuetype.iconUrl && (
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{issue.issuetype.name}</span>
          )}
        </span>
        {issue.status ? <JiraStatusBadge status={issue.status} /> : <span />}
      </Link>
    </IssuePreviewTooltip>
  );
}

function LinkGroup({ group }: { group: IssueLinkGroup }) {
  const reduce = useReducedMotion();
  const { visible, expanded, canExpand, toggle } = useVisibleItems(group.issues, GROUP_LIMIT);
  const hidden = group.issues.length - GROUP_LIMIT;
  return (
    <StaggerItem role="group" aria-label={group.label} className="flex flex-col gap-1">
      <h3 className="flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
        {group.label}
        <span className="tabular-nums opacity-70">{group.issues.length}</span>
      </h3>
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {visible.map((issue) => (
            <motion.li
              key={issue.key}
              initial={{ opacity: 0, y: reduce ? 0 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
            >
              <LinkedIssue issue={issue} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {canExpand && (
        <Button variant="ghost" onClick={toggle} aria-expanded={expanded} className="self-start rounded-xl text-muted-foreground">
          <ChevronDownIcon
            aria-hidden
            className={cn("transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")}
          />
          {expanded ? "Weniger anzeigen" : `${hidden} weitere anzeigen`}
        </Button>
      )}
    </StaggerItem>
  );
}

function LinksSkeleton() {
  return (
    <div aria-busy aria-label="Verknüpfungen werden geladen" className="flex flex-col gap-2">
      <Skeleton className="h-3 w-24" />
      {["w-full", "w-11/12", "w-4/5"].map((width) => (
        <Skeleton key={width} className={cn("h-8 rounded-xl", width)} />
      ))}
    </div>
  );
}

function LinksContent({ summary }: { summary: IssueLinkSummary }) {
  if (summary.total === 0 && summary.unreadable === 0) {
    return <p className="text-sm text-muted-foreground">Keine verknüpften Tickets.</p>;
  }
  return (
    <Stagger className="-mx-2 flex flex-col gap-4">
      {summary.groups.map((group) => (
        <LinkGroup key={group.label} group={group} />
      ))}
      {summary.unreadable > 0 && (
        <StaggerItem className="flex items-start gap-2 px-2 text-xs text-muted-foreground">
          <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            {summary.unreadable === 1
              ? "Eine Verknüpfung liefert keine lesbaren Ticketdaten."
              : `${summary.unreadable} Verknüpfungen liefern keine lesbaren Ticketdaten.`}{" "}
            Möglicherweise fehlt die Berechtigung für das verknüpfte Ticket.
          </span>
        </StaggerItem>
      )}
    </Stagger>
  );
}

export function IssueLinksPanel({ summary, error, refreshError, retrying, onRetry }: IssueLinksPanelProps) {
  const reduce = useReducedMotion();
  const fade = {
    initial: { opacity: 0, y: reduce ? 0 : -4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } },
    transition: { duration: 0.2, ease: EASE_OUT },
  };

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {!!refreshError && (
          <motion.div key="refresh" {...fade}>
            <Alert variant="warning" className="rounded-xl">
              <TriangleAlertIcon />
              <AlertTitle>Aktualisierung fehlgeschlagen. Angezeigt wird der zuletzt geladene Stand.</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                {detailOf(refreshError)}
                <RetryButton retrying={retrying} onRetry={onRetry} />
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false} mode="wait">
        {summary ? (
          <motion.div key="content" {...fade}>
            <LinksContent summary={summary} />
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            {...fade}
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <span className="min-w-0">Verknüpfungen konnten nicht geladen werden. {detailOf(error)}</span>
            <RetryButton retrying={retrying} onRetry={onRetry} />
          </motion.div>
        ) : (
          <motion.div key="loading" {...fade}>
            <LinksSkeleton />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
