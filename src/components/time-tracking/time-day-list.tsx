import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { IssuePreviewTooltip } from "@/components/issues/issue-preview";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import type { WorklogCorrectionContext } from "@/hooks/time-tracking/use-worklog-correction";
import type { WorklogCorrectionSource } from "@/lib/time-tracking/worklog-correction";
import { WorklogCorrectionAction } from "./worklog-correction-action";

export type TimeDayView = {
  day: string;
  label: string;
  total: string;
  isToday: boolean;
  entries: readonly (WorklogCorrectionSource & { id: string; summary: string; comment: string; time: string; duration: string })[];
};

function TimeEntryRow({ entry, correction }: { entry: TimeDayView["entries"][number]; correction: WorklogCorrectionContext | undefined }) {
  const reduce = useReducedMotion();
  const present = useIsPresent();
  const scope = correction?.scope;
  const correctionKey = scope && JSON.stringify([scope, correction.filter, entry.issueId, entry.issueKey]);

  return (
    <motion.li className="flex items-center gap-1" layout={reduce ? false : "position"} initial={{ opacity: 0, y: reduce ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }} whileTap={reduce ? undefined : { scale: 0.99 }} transition={{ duration: 0.16, ease: EASE_OUT, layout: SPRING_LAYOUT }}>
      <Link
        to="/issue/$key"
        params={{ key: entry.issueKey }}
        search={{ bereich: "zeit" }}
        className="grid min-h-12 min-w-0 flex-1 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl px-3 py-2 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-xs text-muted-foreground tabular-nums">{entry.time}</span>
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-baseline gap-2">
            <IssuePreviewTooltip issueKey={entry.issueKey}>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{entry.issueKey}</span>
            </IssuePreviewTooltip>
            <span className="truncate text-sm">{entry.summary}</span>
          </span>
          {entry.comment && <span className="truncate text-xs text-muted-foreground">{entry.comment}</span>}
        </span>
        <span className="text-sm font-medium tabular-nums">{entry.duration}</span>
      </Link>
      {present && correction && scope?.accountId === entry.worklog.author?.accountId && (
        <WorklogCorrectionAction key={correctionKey} context={correction} source={entry} time={entry.time} duration={entry.duration} />
      )}
    </motion.li>
  );
}

export function TimeDayList({
  days,
  emptyDayLabel,
  totalLabel,
  correction,
}: {
  days: readonly TimeDayView[];
  emptyDayLabel: string;
  totalLabel: string;
  correction?: WorklogCorrectionContext;
}) {
  const reduce = useReducedMotion();
  return (
    <Stagger className="relative flex flex-col gap-3">
      <AnimatePresence initial={false} mode="popLayout">
      {days.map((day) => (
        <StaggerItem key={day.day} layout={reduce ? false : "position"} exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }} transition={{ layout: SPRING_LAYOUT }}>
          <section aria-label={day.label} className="flex flex-col gap-1 rounded-2xl border bg-card p-2 shadow-xs">
            <header className="flex items-baseline gap-2 px-3 pt-1.5 pb-1">
              <h2 className="text-sm font-semibold text-balance">{day.label}</h2>
              {day.isToday && <span className="rounded-xl bg-primary/12 px-2 text-xs text-primary">Heute</span>}
              <span className="ml-auto text-sm text-muted-foreground tabular-nums" aria-label={`${totalLabel} ${day.total}`}>
                {day.total}
              </span>
            </header>
            {day.entries.length ? (
              <ul className="flex flex-col">
                <AnimatePresence initial={false}>
                {day.entries.map((entry) => (
                  <TimeEntryRow key={entry.id} entry={entry} correction={correction} />
                ))}
                </AnimatePresence>
              </ul>
            ) : (
              <p className="px-3 pb-2 text-xs text-muted-foreground">{emptyDayLabel}</p>
            )}
          </section>
        </StaggerItem>
      ))}
      </AnimatePresence>
    </Stagger>
  );
}
