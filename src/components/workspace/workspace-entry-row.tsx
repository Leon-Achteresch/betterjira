import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpenIcon, FilePenLineIcon, MessageSquareDashedIcon, PinIcon, StickyNoteIcon, XIcon } from "lucide-react";
import { JiraStatusBadge } from "@/components/jira-status-badge";
import { IconAction } from "@/components/motion/icon-action";
import { EASE_OUT } from "@/lib/ease";
import type { WorkspaceEntryRowProps } from "@/types/workspace-row";
import { cn } from "@/lib/utils";

const CHIP = "inline-flex items-center gap-1 rounded-xl px-2 py-0.5 text-[0.7rem] font-medium";
const ROW_ACTION = "text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100";

export function WorkspaceEntryRow({ entry, linkRef, onTogglePin, onRemoveRecent }: WorkspaceEntryRowProps) {
  const reduce = useReducedMotion();
  const detailsId = useId();
  return (
    <div className="group flex items-start gap-1 rounded-xl p-1 transition-colors hover:bg-muted/60 has-[a:focus-visible]:bg-muted/60">
      <Link
        ref={linkRef}
        to="/issue/$key"
        params={{ key: entry.key }}
        aria-label={entry.known ? `${entry.key}: ${entry.summary}` : entry.key}
        aria-describedby={detailsId}
        className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("font-mono", !entry.known && "text-sm font-medium text-foreground")}>{entry.key}</span>
          {entry.status && (
            <span title="Status beim letzten Öffnen">
              <JiraStatusBadge status={entry.status} className="text-[0.6rem]" />
            </span>
          )}
          {entry.visitedAt > 0 && (
            <time dateTime={new Date(entry.visitedAt).toISOString()} className="ml-auto shrink-0 tabular-nums">
              {formatDistanceToNowStrict(entry.visitedAt, { addSuffix: true, locale: de })}
            </time>
          )}
        </span>
        {entry.known && <span className="text-sm font-medium leading-snug text-pretty">{entry.summary}</span>}
        <span id={detailsId} className="flex flex-col gap-1.5 empty:hidden">
          {entry.note.trim() && (
            <span className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <StickyNoteIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span className="shrink-0 font-medium text-foreground/80">Notiz</span>
              <span className="line-clamp-2 min-w-0 break-words">{entry.note}</span>
            </span>
          )}
          {entry.draft && (
            <span className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MessageSquareDashedIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span className="shrink-0 font-medium text-primary">Entwurf</span>
              <span className="line-clamp-1 min-w-0 break-all">{entry.draft}</span>
            </span>
          )}
          {(entry.hasFieldDraft || entry.hasReadingPosition) && (
            <span className="flex flex-wrap gap-1.5">
              {entry.hasFieldDraft && (
                <span className={cn(CHIP, "bg-primary/12 text-primary")}>
                  <FilePenLineIcon aria-hidden className="size-3" />
                  Feldentwurf
                </span>
              )}
              {entry.hasReadingPosition && (
                <span className={cn(CHIP, "bg-muted text-muted-foreground")}>
                  <BookOpenIcon aria-hidden className="size-3" />
                  Lesestelle gemerkt
                </span>
              )}
            </span>
          )}
        </span>
      </Link>
      <div className="mt-1.5 flex shrink-0 items-center">
        <IconAction
          label={`${entry.key} ${entry.pinned ? "lösen" : "anheften"}`}
          tooltip={entry.pinned ? "Lösen" : "Anheften"}
          pressed={entry.pinned}
          onClick={onTogglePin}
          className={cn(ROW_ACTION, entry.pinned && "text-primary sm:opacity-100")}
        >
          <PinIcon className={cn(entry.pinned && "fill-current")} />
        </IconAction>
        <AnimatePresence initial={false}>
          {entry.recent && (
            <motion.span
              key="remove-recent"
              className="flex"
              initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: 0.16, ease: EASE_OUT } }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.96, transition: { duration: 0.12, ease: EASE_OUT } }}
            >
              <IconAction
                label={`${entry.key} aus Zuletzt entfernen`}
                tooltip="Aus Zuletzt entfernen"
                onClick={onRemoveRecent}
                className={ROW_ACTION}
              >
                <XIcon />
              </IconAction>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
