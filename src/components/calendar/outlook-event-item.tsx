import { motion, useReducedMotion } from "motion/react";
import { ExternalLinkIcon } from "lucide-react";
import type { OutlookCalendarEvent } from "@/lib/calendar/model";
import { eventTimeRange } from "@/lib/calendar/presentation";
import { SPRING_PRESS } from "@/lib/ease";

type OutlookEventItemProps = {
  event: OutlookCalendarEvent;
  day?: Date;
  onOpen: () => void;
};

export function OutlookEventItem({ event, day, onOpen }: OutlookEventItemProps) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={SPRING_PRESS}
      className="group/event flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="h-6 w-1 shrink-0 rounded-full bg-sky-500" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{event.title || "Ohne Titel"}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">{eventTimeRange(event, day)} · Outlook</span>
      </span>
      <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/event:opacity-100" />
    </motion.button>
  );
}
