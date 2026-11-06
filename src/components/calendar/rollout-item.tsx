import { motion, useReducedMotion } from "motion/react";
import { BellIcon, ExternalLinkIcon, PencilIcon, RefreshCwIcon, TicketIcon, Trash2Icon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Rollout } from "@/lib/calendar/model";
import { canSyncRollout, OUTLOOK_LINK_LABELS, reminderLabel, timeRange, type OutlookLinkState } from "@/lib/calendar/presentation";
import { SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

type RolloutItemProps = {
  rollout: Rollout;
  day?: Date;
  linkState: OutlookLinkState;
  outlookConnected: boolean;
  syncing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSync: () => void;
  onOpenOutlook: () => void;
  onOpenIssue: (key: string) => void;
};

const LINK_TONE: Record<OutlookLinkState, string> = {
  local: "text-muted-foreground",
  linked: "text-sky-600 dark:text-sky-400",
  disconnected: "text-amber-600 dark:text-amber-400",
  "other-account": "text-amber-600 dark:text-amber-400",
};

export function RolloutItem({ rollout, day, linkState, outlookConnected, syncing, onEdit, onDelete, onSync, onOpenOutlook, onOpenIssue }: RolloutItemProps) {
  const reduce = useReducedMotion();
  const syncable = outlookConnected && canSyncRollout(linkState);
  return (
    <motion.article
      whileHover={reduce ? undefined : { y: -1 }}
      transition={SPRING_PRESS}
      className="group/rollout relative flex flex-col gap-2 rounded-lg border bg-background p-3 shadow-xs"
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 h-8 w-1 shrink-0 rounded-full bg-primary" />
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <h3 className="truncate text-sm font-semibold">{rollout.title}</h3>
          <p className="text-xs text-muted-foreground tabular-nums">{timeRange(rollout, day)}</p>
        </button>
        <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover/rollout:opacity-100 group-focus-within/rollout:opacity-100">
          <Tooltip content="Bearbeiten">
            <Button variant="ghost" size="icon-xs" aria-label="Bearbeiten" onClick={onEdit}>
              <PencilIcon />
            </Button>
          </Tooltip>
          <Tooltip content="Löschen">
            <Button variant="ghost" size="icon-xs" aria-label="Löschen" onClick={onDelete}>
              <Trash2Icon />
            </Button>
          </Tooltip>
        </div>
      </div>
      {rollout.issues.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-3">
          {rollout.issues.map((issue) => (
            <Tooltip key={issue.key} content={issue.summary || issue.key}>
              <button
                type="button"
                onClick={() => onOpenIssue(issue.key)}
                className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <TicketIcon className="size-3 text-muted-foreground" />
                {issue.key}
              </button>
            </Tooltip>
          ))}
        </div>
      )}
      {rollout.notes && <p className="line-clamp-2 pl-3 text-xs whitespace-pre-line text-muted-foreground">{rollout.notes}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-3 text-[11px]">
        {rollout.reminderMinutes > 0 && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <BellIcon className="size-3" />
            {reminderLabel(rollout.reminderMinutes)}
          </span>
        )}
        <span className={cn("inline-flex items-center gap-1", LINK_TONE[linkState])}>
          <span className="size-1.5 rounded-full bg-current" />
          {OUTLOOK_LINK_LABELS[linkState]}
        </span>
      </div>
      {outlookConnected && (
        <div className="flex flex-wrap items-center gap-1.5 pl-3">
          <Tooltip
            content={
              syncable
                ? linkState === "linked"
                  ? "Lokale Änderungen werden erst nach erneutem Synchronisieren in Outlook übernommen."
                  : "Legt den Termin samt Erinnerung in Outlook an."
                : "Der Termin gehört zu einem anderen Outlook-Kalender."
            }
          >
            <Button variant="outline" size="xs" disabled={!syncable || syncing} onClick={onSync}>
              {syncing ? <Spinner /> : <RefreshCwIcon />}
              {linkState === "linked" ? "Erneut synchronisieren" : "Mit Outlook synchronisieren"}
            </Button>
          </Tooltip>
          {linkState === "linked" && (
            <Button variant="ghost" size="xs" onClick={onOpenOutlook}>
              <ExternalLinkIcon />
              In Outlook öffnen
            </Button>
          )}
        </div>
      )}
      {linkState === "other-account" && (
        <Badge variant="outline" className="ml-3 w-fit text-[11px] font-normal text-muted-foreground">
          Löschen und Synchronisieren nur mit dem ursprünglichen Kalender möglich
        </Badge>
      )}
    </motion.article>
  );
}
