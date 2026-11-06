import { createFileRoute } from "@tanstack/react-router";
import { TimerIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { SessionGate } from "@/components/shell/session-gate";
import { TimeDayList } from "@/components/time-tracking/time-day-list";
import { TimeRangeBar } from "@/components/time-tracking/time-range-bar";
import { TimeNoticeSlot, TimeTrackingEmpty, TimeTrackingNotice, TimeTrackingSkeleton } from "@/components/time-tracking/time-states";
import { TimeSummaryTiles } from "@/components/time-tracking/time-summary";
import { useTimeTrackingPage } from "@/hooks/time-tracking/use-time-tracking-page";
import { EASE_OUT } from "@/lib/ease";
import { timeRangeSearch } from "@/lib/time-tracking/range";

export const Route = createFileRoute("/zeiterfassung")({
  validateSearch: timeRangeSearch,
  component: Zeiterfassung,
});

function Zeiterfassung() {
  const page = useTimeTrackingPage(Route.useSearch());
  const reduce = useReducedMotion();
  const view = page.error ? "error" : page.pending ? "pending" : "ready";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <TimerIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-balance">Meine Zeiterfassung</h1>
          <p className="text-sm text-muted-foreground">Deine in Jira gebuchten Zeiten, Tag für Tag.</p>
        </div>
      </div>
      <SessionGate
        session={page.session}
        className="flex flex-col gap-6"
        pending={<TimeTrackingSkeleton />}
        unconnected={<LoginPrompt description="Melde dich an, um deine gebuchten Zeiten zu sehen." />}
      >
        <TimeRangeBar
          presets={page.presets}
          label={page.label}
          rangeKey={page.rangeKey}
          previousLabel={page.previousLabel}
          nextLabel={page.nextLabel}
          refreshing={page.refreshing}
          onPrevious={page.previous}
          onNext={page.next}
          onRefresh={page.refresh}
        />
        <AnimatePresence initial={false}>
          {page.refreshError && (
            <TimeNoticeSlot key="refresh-error">
              <TimeTrackingNotice
                tone="destructive"
                title="Aktualisierung fehlgeschlagen"
                messages={["Angezeigt wird der zuletzt geladene Stand.", page.refreshError.message]}
                onRetry={page.retry}
              />
            </TimeNoticeSlot>
          )}
          {page.partial.length > 0 && (
            <TimeNoticeSlot key="partial">
              <TimeTrackingNotice
                tone="warning"
                title="Unvollständig geladen"
                messages={[...page.partial, "Die Summen zeigen nur den geladenen Stand."]}
                retryLabel="Fehlende laden"
                onRetry={page.canRetryFailed ? page.retryFailed : undefined}
              />
            </TimeNoticeSlot>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${view}:${page.rangeKey}`}
            initial={{ opacity: 0, y: reduce ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="flex flex-col gap-6"
          >
            {view === "pending" && <TimeTrackingSkeleton />}
            {view === "error" && (
              <TimeTrackingNotice
                tone="destructive"
                title="Buchungen konnten nicht geladen werden"
                messages={[page.error?.message ?? "Unbekannter Fehler."]}
                onRetry={page.retry}
              />
            )}
            {view === "ready" && (
              <>
                <TimeSummaryTiles total={page.total} totalLabel={page.totalLabel} hint={page.totalHint} entries={page.entryCount} issues={page.issueCount} />
                {page.empty ? (
                  <TimeTrackingEmpty title={page.emptyTitle} description="In diesem Zeitraum hast du in Jira keine Zeit gebucht." />
                ) : (
                  <TimeDayList days={page.days} emptyDayLabel="Keine Buchungen" />
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </SessionGate>
    </div>
  );
}
