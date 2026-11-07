import type { Ref } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarCheckIcon, CalendarPlusIcon, PlusIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { OutlookAccount, OutlookCalendarEvent, Rollout } from "@/lib/calendar/model";
import { dayKey, dayTitle, errorMessage } from "@/lib/calendar/presentation";
import { EASE_OUT } from "@/lib/ease";
import { RolloutList, type RolloutActions } from "./rollout-list";

type DayAgendaProps = RolloutActions & {
  day: Date;
  rollouts: readonly Rollout[];
  events: readonly OutlookCalendarEvent[];
  pending: boolean;
  eventsPending: boolean;
  eventsError: Error | null;
  account: OutlookAccount | null;
  syncingId: string | null | undefined;
  onCreate: () => void;
  ref?: Ref<HTMLElement>;
};

export function DayAgenda({ ref, day, rollouts, events, pending, eventsPending, eventsError, onCreate, ...list }: DayAgendaProps) {
  const reduce = useReducedMotion();
  const empty = !pending && rollouts.length === 0 && events.length === 0;
  return (
    <section ref={ref} className="flex scroll-mt-4 flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Tagesagenda">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={dayKey(day)}
              initial={{ opacity: 0, y: reduce ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="truncate text-base font-semibold"
            >
              {dayTitle(day)}
            </motion.h2>
          </AnimatePresence>
        </div>
        <Button size="sm" variant="outline" onClick={onCreate}>
          <PlusIcon />
          Rollout
        </Button>
      </div>
      {pending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      ) : empty ? (
        <Empty className="border-0 p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarCheckIcon />
            </EmptyMedia>
            <EmptyTitle>Nichts geplant</EmptyTitle>
            <EmptyDescription>An diesem Tag stehen keine Rollouts{list.account ? " oder Outlook-Termine" : ""} an.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={onCreate}>
              <CalendarPlusIcon />
              Rollout planen
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <RolloutList key={dayKey(day)} day={day} rollouts={rollouts} events={events} {...list} />
      )}
      {list.account && eventsPending && <Skeleton className="h-10 rounded-lg" />}
      {eventsError && (
        <Alert variant="destructive">
          <AlertTitle>Outlook-Termine nicht verfügbar</AlertTitle>
          <AlertDescription>{errorMessage(eventsError, "Outlook ist nicht erreichbar.")}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
