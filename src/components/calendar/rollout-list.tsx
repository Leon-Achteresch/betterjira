import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { OutlookAccount, OutlookCalendarEvent, Rollout } from "@/lib/calendar/model";
import { outlookLinkState } from "@/lib/calendar/presentation";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import type { RolloutActions } from "@/types/calendar";
import { OutlookEventItem } from "./outlook-event-item";
import { RolloutItem } from "./rollout-item";

type RolloutListProps = RolloutActions & {
  rollouts: readonly Rollout[];
  events?: readonly OutlookCalendarEvent[];
  day?: Date;
  account: OutlookAccount | null;
  syncingId: string | null | undefined;
};

export function RolloutList({ rollouts, events = [], day, account, syncingId, onEdit, onDuplicate, onDelete, onSync, onOpenOutlook, onOpenIssue }: RolloutListProps) {
  const reduce = useReducedMotion();
  const enter = { opacity: 0, y: reduce ? 0 : 6 };
  return (
    <motion.ul className="flex flex-col gap-2" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }}>
      <AnimatePresence initial={false}>
        {rollouts.map((rollout) => (
          <motion.li
            key={rollout.id}
            layout={!reduce}
            variants={{ hidden: enter, show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } } }}
            exit={{ opacity: 0, scale: reduce ? 1 : 0.97, transition: { duration: 0.14 } }}
            transition={SPRING_LAYOUT}
          >
            <RolloutItem
              rollout={rollout}
              day={day}
              linkState={outlookLinkState(rollout, account)}
              outlookConnected={!!account}
              syncing={syncingId === rollout.id}
              onEdit={() => onEdit(rollout)}
              onDuplicate={() => onDuplicate(rollout)}
              onDelete={() => onDelete(rollout)}
              onSync={() => onSync(rollout)}
              onOpenOutlook={() => rollout.outlookEventId && onOpenOutlook(rollout.outlookEventId)}
              onOpenIssue={(key) => onOpenIssue(rollout, key)}
            />
          </motion.li>
        ))}
        {events.map((event) => (
          <motion.li
            key={`outlook-${event.id}`}
            layout={!reduce}
            variants={{ hidden: enter, show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={SPRING_LAYOUT}
          >
            <OutlookEventItem event={event} day={day} onOpen={() => onOpenOutlook(event.id)} />
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
