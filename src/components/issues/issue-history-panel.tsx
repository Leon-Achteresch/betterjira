import { useId, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRightIcon, ChevronRightIcon, TriangleAlertIcon, UserRoundIcon } from "lucide-react";
import { JiraUserAvatar } from "@/components/jira-user-avatar";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useFocusRescue } from "@/hooks/use-focus-rescue";
import { EASE_OUT } from "@/lib/ease";
import {
  historyErrorDetail,
  type HistoryAuthor,
  type HistoryChange,
  type HistoryEntry,
  type HistoryValue,
  type IssueHistory,
} from "@/lib/jira/issue-history";
import { cn } from "@/lib/utils";

type IssueHistoryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history?: IssueHistory;
  limit: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  error: unknown;
  refreshError: unknown;
  moreError: unknown;
  retrying: boolean;
  onRetry: () => void;
};

const fadeOf = (reduce: boolean | null) => ({
  initial: { opacity: 0, y: reduce ? 0 : -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } },
  transition: { duration: 0.2, ease: EASE_OUT },
});

function RetryButton({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <Button
      variant="outline"
      aria-disabled={retrying}
      onClick={retrying ? undefined : onRetry}
      className="rounded-xl aria-disabled:opacity-60"
    >
      {retrying && <Spinner aria-hidden />}
      Erneut versuchen
    </Button>
  );
}

function AuthorLabel({ author }: { author?: HistoryAuthor }) {
  if (!author) {
    return (
      <span className="flex items-center gap-2 text-muted-foreground">
        <Avatar size="sm">
          <AvatarFallback>
            <UserRoundIcon aria-hidden className="size-3.5" />
          </AvatarFallback>
        </Avatar>
        Unbekannte Person
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      {author.avatarUrl ? (
        <JiraUserAvatar user={{ displayName: author.displayName, avatarUrls: { "48x48": author.avatarUrl } }} />
      ) : (
        <Avatar size="sm">
          <AvatarFallback>{author.displayName.charAt(0)}</AvatarFallback>
        </Avatar>
      )}
      <span className="truncate font-medium">{author.displayName}</span>
    </span>
  );
}

function ChangeTime({ created }: { created?: string }) {
  if (!created) return <span className="text-xs text-muted-foreground">Zeitpunkt unbekannt</span>;
  const date = new Date(created);
  const absolute = date.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
  return (
    <time dateTime={created} title={absolute} className="text-xs text-muted-foreground tabular-nums">
      {formatDistanceToNowStrict(date, { locale: de, addSuffix: true })}
      <span className="sr-only"> ({absolute})</span>
    </time>
  );
}

function ValueText({ value, expanded, previous }: { value: HistoryValue; expanded: boolean; previous?: boolean }) {
  if (value.kind === "empty") return <span className="text-muted-foreground italic">leer</span>;
  if (value.kind === "opaque") return <span className="text-muted-foreground italic">ohne Anzeigetext</span>;
  return (
    <span
      className={cn(
        "max-w-full min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]",
        previous && "text-muted-foreground",
        value.long && !expanded && "line-clamp-3",
      )}
    >
      {value.text}
    </span>
  );
}

const isLong = (value: HistoryValue) => value.kind === "text" && value.long;

function ChangeRow({ change }: { change: HistoryChange }) {
  const [expanded, setExpanded] = useState(false);
  const valuesId = useId();
  const long = isLong(change.from) || isLong(change.to);
  return (
    <div className="grid gap-1 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:gap-4">
      <dt className="text-xs text-muted-foreground @xl:pt-0.5">{change.field}</dt>
      <dd className="flex min-w-0 flex-col items-start gap-1 text-sm">
        <div id={valuesId} className="flex max-w-full min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="sr-only">von</span>
          <ValueText value={change.from} expanded={expanded} previous />
          <ArrowRightIcon aria-hidden className="size-3.5 shrink-0 self-center text-muted-foreground" />
          <span className="sr-only">zu</span>
          <ValueText value={change.to} expanded={expanded} />
        </div>
        {long && (
          <Button
            variant="ghost"
            aria-expanded={expanded}
            aria-controls={valuesId}
            onClick={() => setExpanded((current) => !current)}
            className="-ml-2 rounded-xl text-xs text-muted-foreground aria-expanded:bg-transparent"
          >
            {expanded ? "Weniger anzeigen" : "Vollständig anzeigen"}
          </Button>
        )}
      </dd>
    </div>
  );
}

function EntryItem({ entry }: { entry: HistoryEntry }) {
  return (
    <article className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <AuthorLabel author={entry.author} />
        <ChangeTime created={entry.created} />
      </div>
      {entry.changes.length > 0 ? (
        <dl className="flex flex-col gap-2 pl-8">
          {entry.changes.map((change, index) => (
            <ChangeRow key={index} change={change} />
          ))}
        </dl>
      ) : (
        <p className="pl-8 text-sm text-muted-foreground">Jira hat zu dieser Änderung keine Felddetails geliefert.</p>
      )}
    </article>
  );
}

function HistorySkeleton() {
  return (
    <div aria-busy aria-label="Änderungsverlauf wird geladen" className="flex flex-col gap-5">
      {["w-2/3", "w-1/2", "w-3/5"].map((width) => (
        <div key={width} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className={cn("ml-8 h-4", width)} />
        </div>
      ))}
    </div>
  );
}

const coverageText = ({ covered, total }: IssueHistory) => {
  if (covered >= total) return total === 1 ? "1 Änderung" : `Alle ${total} Änderungen`;
  return `Die neuesten ${covered} von ${total} Änderungen`;
};

function HistoryContent({
  history,
  limit,
  hasMore,
  loadingMore,
  onLoadMore,
  onSettled,
}: Pick<IssueHistoryPanelProps, "limit" | "hasMore" | "loadingMore" | "onLoadMore"> & {
  history: IssueHistory;
  onSettled: () => void;
}) {
  const fade = fadeOf(useReducedMotion());
  if (history.total === 0 && history.entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Änderungen erfasst.</p>;
  }
  const limitReached = !hasMore && history.covered < history.total;
  return (
    <div className="flex flex-col gap-5">
      <Stagger role="list" className="flex flex-col gap-5">
        {history.entries.map((entry) => (
          <StaggerItem key={entry.id} role="listitem">
            <EntryItem entry={entry} />
          </StaggerItem>
        ))}
      </Stagger>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span aria-live="polite" className="tabular-nums">
          {coverageText(history)}
        </span>
        <AnimatePresence initial={false} onExitComplete={onSettled}>
          {hasMore && (
            <motion.div key="more" {...fade}>
              <Button
                variant="outline"
                aria-disabled={loadingMore}
                onClick={loadingMore ? undefined : onLoadMore}
                className="rounded-xl aria-disabled:opacity-60"
              >
                {loadingMore && <Spinner aria-hidden />}
                Ältere laden
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {limitReached && (
        <p className="text-xs text-muted-foreground">
          Hier werden höchstens die neuesten {limit} Änderungen angezeigt. Ältere Einträge findest du direkt in Jira.
        </p>
      )}
    </div>
  );
}

function HistoryBody({ onSettled, ...props }: Omit<IssueHistoryPanelProps, "open" | "onOpenChange"> & { onSettled: () => void }) {
  const fade = fadeOf(useReducedMotion());
  const { history, error, refreshError, moreError, retrying, onRetry } = props;
  const staleError = moreError ?? refreshError;
  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false} onExitComplete={onSettled}>
        {!!staleError && (
          <motion.div key="stale" {...fade}>
            <Alert variant="warning" className="rounded-xl">
              <TriangleAlertIcon />
              <AlertTitle>
                {moreError
                  ? "Ältere Änderungen konnten nicht geladen werden. Die bisher geladenen bleiben sichtbar."
                  : "Aktualisierung fehlgeschlagen. Angezeigt wird der zuletzt geladene Stand."}
              </AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                {historyErrorDetail(staleError)}
                <RetryButton retrying={retrying} onRetry={onRetry} />
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false} mode="wait" onExitComplete={onSettled}>
        {history ? (
          <motion.div key="content" {...fade}>
            <HistoryContent {...props} history={history} onSettled={onSettled} />
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            {...fade}
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <span className="min-w-0">Änderungsverlauf konnte nicht geladen werden. {historyErrorDetail(error)}</span>
            <RetryButton retrying={retrying} onRetry={onRetry} />
          </motion.div>
        ) : (
          <motion.div key="loading" {...fade}>
            <HistorySkeleton />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function IssueHistoryPanel({ open, onOpenChange, ...props }: IssueHistoryPanelProps) {
  const fade = fadeOf(useReducedMotion());
  const headingId = useId();
  const regionId = useId();
  const focus = useFocusRescue<HTMLDivElement>();
  const total = props.history?.total;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="-mx-2 flex">
        <Button
          variant="ghost"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => onOpenChange(!open)}
          className="rounded-xl px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase aria-expanded:bg-transparent hover:aria-expanded:bg-muted"
        >
          <ChevronRightIcon
            aria-hidden
            className={cn("transition-transform duration-200 motion-reduce:transition-none", open && "rotate-90")}
          />
          Änderungsverlauf
          {open && total !== undefined && total > 0 && <span className="tabular-nums">· {total}</span>}
        </Button>
      </h2>
      <div id={regionId} ref={focus.ref} tabIndex={-1} className="outline-none">
        <AnimatePresence initial={false}>
          {open && (
            <motion.div key="history" {...fade}>
              <HistoryBody {...props} onSettled={focus.rescue} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
