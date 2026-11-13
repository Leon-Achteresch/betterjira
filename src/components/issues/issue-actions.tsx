import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRightIcon,
  CopyIcon,
  EllipsisIcon,
  FileTextIcon,
  GitBranchIcon,
  LinkIcon,
  PaperclipIcon,
  PinIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  StickyNoteIcon,
  TimerIcon,
  SunIcon,
  CalendarClockIcon,
  ListMinusIcon,
} from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { useIssueActions } from "@/hooks/use-issue-actions";
import { SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

const MotionButton = motion.create(Button);

export function IssueActions({
  actions,
  attachmentCount,
  timeSpent,
  refreshing,
  onRefresh,
}: {
  actions: ReturnType<typeof useIssueActions>;
  attachmentCount: number;
  timeSpent?: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="ml-auto flex items-center gap-1">
      <Button
        ref={actions.detailsRef}
        variant="outline"
        size="sm"
        onClick={() => actions.show("details")}
        aria-label="Details öffnen"
      >
        <SlidersHorizontalIcon />
        Details
      </Button>
      <Tooltip content={actions.pinned ? "Nicht mehr anheften" : "Anheften · in Weiterarbeiten merken"} side="bottom">
        <MotionButton
          variant="ghost"
          size="icon-sm"
          aria-label={actions.pinned ? "Nicht mehr anheften" : "Vorgang anheften"}
          aria-pressed={actions.pinned}
          disabled={!actions.ready}
          onClick={actions.togglePin}
          whileTap={reduce ? undefined : { scale: 0.96 }}
          transition={SPRING_PRESS}
          className={cn("text-muted-foreground", actions.pinned && "bg-primary/10 text-primary")}
        >
          <PinIcon />
        </MotionButton>
      </Tooltip>
      <DropdownMenu>
        <Tooltip content="Weitere Aktionen" side="bottom">
          <DropdownMenuTrigger asChild>
            <Button ref={actions.menuRef} variant="ghost" size="icon-sm" aria-label="Weitere Ticketaktionen">
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem disabled={!actions.ready || actions.planned === "today"} onSelect={() => actions.planFor("today")}>
            <SunIcon /> Für heute planen
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!actions.ready || actions.planned === "later"} onSelect={() => actions.planFor("later")}>
            <CalendarClockIcon /> Für später planen
          </DropdownMenuItem>
          {actions.planned && <DropdownMenuItem onSelect={() => actions.planFor(null)}><ListMinusIcon /> Aus persönlichem Plan entfernen</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => actions.show("note")}>
            <StickyNoteIcon />
            Private Notiz für später
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.show("attachments")}>
            <PaperclipIcon />
            Anhänge<span className="ml-auto text-xs text-muted-foreground tabular-nums">{attachmentCount}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.show("time")}>
            <TimerIcon />
            Zeit erfassen{timeSpent && <span className="ml-auto text-xs text-muted-foreground">{timeSpent}</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.show("development")}>
            <GitBranchIcon />
            Entwicklung
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onRefresh} disabled={refreshing}>
            {refreshing ? <Spinner aria-hidden /> : <RefreshCwIcon />}
            {refreshing ? "Wird aktualisiert …" : "Aktualisieren"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.copyKey}>
            <CopyIcon />
            Schlüssel kopieren
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.description.copy} disabled={actions.description.disabled} className="min-h-8 items-start">
            <FileTextIcon className="mt-0.5" />
            <span className="flex min-w-0 flex-col">
              Beschreibung kopieren
              {actions.description.hint && <span className="text-xs">{actions.description.hint}</span>}
            </span>
          </DropdownMenuItem>
          {actions.openInJira && (
            <>
              <DropdownMenuItem onSelect={actions.copyLink}>
                <LinkIcon />
                Link kopieren
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={actions.openInJira}>
                <ArrowUpRightIcon />
                In Jira öffnen
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
