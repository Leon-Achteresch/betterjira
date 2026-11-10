import { useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon, InfoIcon, Link2OffIcon, TriangleAlertIcon } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Tooltip } from "@/components/motion/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useVisibleItems } from "@/hooks/use-visible-items";
import { EASE_OUT, SPRING_PRESS } from "@/lib/ease";
import { jiraErrors } from "@/lib/jira/field-values";
import type { RemoteLinkRow, RemoteLinkSummary } from "@/lib/jira/remote-links";
import { cn } from "@/lib/utils";

const VISIBLE_LIMIT = 5;

type RemoteLinksPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary?: RemoteLinkSummary;
  error: unknown;
  refreshError: unknown;
  retrying: boolean;
  onRetry: () => void;
  onOpenLink: (href: string) => void;
};

const detailOf = (error: unknown) => jiraErrors(error).messages.join(" ");

const fadeOf = (reduce: boolean | null) => ({
  initial: { opacity: 0, y: reduce ? 0 : -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } },
  transition: { duration: 0.2, ease: EASE_OUT },
});

const WRAP = "min-w-0 [overflow-wrap:anywhere]";

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

function LinkText({ link }: { link: RemoteLinkRow }) {
  const meta = [link.relationship, link.application, link.host].filter(Boolean).join(" · ");
  return (
    <span className="flex min-w-0 flex-col gap-0.5 text-left">
      <span className={cn(WRAP, link.resolved && "line-through decoration-muted-foreground", !link.title && "text-muted-foreground")}>
        {link.title ?? "Ohne Titel"}
        {link.resolved && <span className="sr-only"> (erledigt)</span>}
      </span>
      {meta && <span className={cn(WRAP, "text-xs text-muted-foreground")}>{meta}</span>}
      {link.summary && <span className={cn(WRAP, "text-xs text-muted-foreground")}>{link.summary}</span>}
    </span>
  );
}

const ROW = "grid min-h-9 w-full grid-cols-[1rem_minmax(0,1fr)] items-start gap-3 rounded-xl px-2 py-2 text-sm";

function RemoteLink({ link, onOpenLink }: { link: RemoteLinkRow; onOpenLink: (href: string) => void }) {
  const reduce = useReducedMotion();
  const { href } = link;
  if (!href) {
    return (
      <div className={ROW}>
        <Link2OffIcon aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <LinkText link={link} />
          <span className="text-xs text-muted-foreground">Nicht öffnbar: Jira liefert kein gültiges http- oder https-Ziel.</span>
        </span>
      </div>
    );
  }
  return (
    <Tooltip content={`Im Browser öffnen · ${link.host}`}>
      <motion.button
        type="button"
        onClick={() => onOpenLink(href)}
        whileTap={reduce ? undefined : { scale: 0.98 }}
        transition={SPRING_PRESS}
        className={cn(ROW, "outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50")}
      >
        <ExternalLinkIcon aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
        <span className="flex min-w-0 flex-col">
          <LinkText link={link} />
          <span className="sr-only">, öffnet im Browser</span>
        </span>
      </motion.button>
    </Tooltip>
  );
}

function LinksContent({ summary, onOpenLink }: { summary: RemoteLinkSummary; onOpenLink: (href: string) => void }) {
  const { visible, expanded, canExpand, toggle } = useVisibleItems(summary.links, VISIBLE_LIMIT);
  if (summary.links.length === 0 && summary.unreadable === 0) {
    return <p className="text-sm text-muted-foreground">Keine externen Links.</p>;
  }
  return (
    <div className="-mx-2 flex flex-col gap-2">
      <Stagger role="list" className="flex flex-col">
        {visible.map((link) => (
          <StaggerItem key={link.id} role="listitem">
            <RemoteLink link={link} onOpenLink={onOpenLink} />
          </StaggerItem>
        ))}
      </Stagger>
      {canExpand && (
        <Button variant="ghost" onClick={toggle} aria-expanded={expanded} className="self-start rounded-xl text-muted-foreground">
          <ChevronDownIcon
            aria-hidden
            className={cn("transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")}
          />
          {expanded ? "Weniger anzeigen" : `${summary.links.length - VISIBLE_LIMIT} weitere anzeigen`}
        </Button>
      )}
      {summary.unreadable > 0 && (
        <p className="flex items-start gap-2 px-2 text-xs text-muted-foreground">
          <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          {summary.unreadable === 1
            ? "Ein externer Link liefert keine lesbaren Daten."
            : `${summary.unreadable} externe Links liefern keine lesbaren Daten.`}
        </p>
      )}
    </div>
  );
}

function LinksSkeleton() {
  return (
    <div aria-busy aria-label="Externe Links werden geladen" className="flex flex-col gap-2">
      {["w-full", "w-4/5"].map((width) => (
        <Skeleton key={width} className={cn("h-9 rounded-xl", width)} />
      ))}
    </div>
  );
}

function LinksBody({ summary, error, refreshError, retrying, onRetry, onOpenLink, onSettled }: Omit<RemoteLinksPanelProps, "open" | "onOpenChange"> & { onSettled: () => void }) {
  const fade = fadeOf(useReducedMotion());
  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false} onExitComplete={onSettled}>
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
      <AnimatePresence initial={false} mode="wait" onExitComplete={onSettled}>
        {summary ? (
          <motion.div key="content" {...fade}>
            <LinksContent summary={summary} onOpenLink={onOpenLink} />
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            {...fade}
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <span className={WRAP}>Externe Links konnten nicht geladen werden. {detailOf(error)}</span>
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

export function RemoteLinksPanel({ open, onOpenChange, ...props }: RemoteLinksPanelProps) {
  const fade = fadeOf(useReducedMotion());
  const headingId = useId();
  const regionId = useId();
  const region = useRef<HTMLDivElement>(null);
  const rescueFocus = () => {
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) region.current?.focus({ preventScroll: true });
  };
  const count = props.summary?.links.length;
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
          Externe Links
          {open && count !== undefined && <span className="tabular-nums">· {count}</span>}
        </Button>
      </h2>
      <div id={regionId} ref={region} tabIndex={-1} className="outline-none">
        <AnimatePresence initial={false}>
          {open && (
            <motion.div key="remote-links" {...fade}>
              <LinksBody {...props} onSettled={rescueFocus} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
