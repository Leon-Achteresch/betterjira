import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { isSameDay, isSameMonth } from "date-fns";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { dayKey, itemsOn, monthTitle, WEEKDAY_LABELS } from "@/lib/calendar/presentation";
import type { OutlookCalendarEvent, Rollout } from "@/lib/calendar/model";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

const MAX_CHIPS = 3;

const shift = (axis: "x" | "y", value: number) => (axis === "x" ? { x: value } : { y: value });

const slide = (axis: "x" | "y", offset: number, duration: number): Variants => ({
  enter: (direction: number) => ({ opacity: 0, ...shift(axis, direction * offset) }),
  center: { opacity: 1, ...shift(axis, 0), transition: { duration, ease: EASE_OUT } },
  exit: (direction: number) => ({ opacity: 0, ...shift(axis, -direction * offset), transition: { duration: duration * 0.55, ease: EASE_OUT } }),
});

type MonthGridProps = {
  month: Date;
  direction: number;
  days: Date[];
  selected: Date;
  today: Date;
  rollouts: readonly Rollout[];
  events: readonly OutlookCalendarEvent[];
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelect: (day: Date) => void;
  onCreate: (day: Date) => void;
  onEdit: (rollout: Rollout) => void;
};

export function MonthGrid({ month, direction, days, selected, today, rollouts, events, onPrevious, onNext, onToday, onSelect, onCreate, onEdit }: MonthGridProps) {
  const reduce = useReducedMotion();
  const titleSlide = slide("y", reduce ? 0 : 6, 0.2);
  const gridSlide = slide("x", reduce ? 0 : 12, 0.26);
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card" aria-label="Monatsansicht">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="relative h-7 min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.h2
              key={dayKey(month)}
              custom={direction}
              variants={titleSlide}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 text-lg font-semibold capitalize leading-7"
              aria-live="polite"
            >
              {monthTitle(month)}
            </motion.h2>
          </AnimatePresence>
        </div>
        <Button variant="outline" size="sm" onClick={onToday}>
          Heute
        </Button>
        <Tooltip content="Vorheriger Monat" side="bottom">
          <Button variant="ghost" size="icon-sm" aria-label="Vorheriger Monat" onClick={onPrevious}>
            <ChevronLeftIcon />
          </Button>
        </Tooltip>
        <Tooltip content="Nächster Monat" side="bottom">
          <Button variant="ghost" size="icon-sm" aria-label="Nächster Monat" onClick={onNext}>
            <ChevronRightIcon />
          </Button>
        </Tooltip>
      </div>
      <div className="grid grid-cols-7 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-1.5 text-center">
            {label}
          </div>
        ))}
      </div>
      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={dayKey(month)}
            role="grid"
            className="grid auto-rows-[minmax(6.5rem,1fr)] grid-cols-7"
            custom={direction}
            variants={gridSlide}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {days.map((day) => (
              <DayCell
                key={dayKey(day)}
                day={day}
                inMonth={isSameMonth(day, month)}
                isToday={isSameDay(day, today)}
                isSelected={isSameDay(day, selected)}
                rollouts={itemsOn(rollouts, day)}
                events={itemsOn(events, day)}
                onSelect={onSelect}
                onCreate={onCreate}
                onEdit={onEdit}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

type DayCellProps = {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  rollouts: readonly Rollout[];
  events: readonly OutlookCalendarEvent[];
  onSelect: (day: Date) => void;
  onCreate: (day: Date) => void;
  onEdit: (rollout: Rollout) => void;
};

function DayCell({ day, inMonth, isToday, isSelected, rollouts, events, onSelect, onCreate, onEdit }: DayCellProps) {
  const reduce = useReducedMotion();
  const visibleRollouts = rollouts.slice(0, MAX_CHIPS);
  const visibleEvents = events.slice(0, Math.max(0, MAX_CHIPS - visibleRollouts.length));
  const hidden = rollouts.length + events.length - visibleRollouts.length - visibleEvents.length;
  const total = rollouts.length + events.length;
  return (
    <div role="gridcell" aria-selected={isSelected} className="group/day relative border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0">
      {isSelected && (
        <motion.div
          layoutId={reduce ? undefined : "calendar-selected-day"}
          className="absolute inset-0.5 rounded-lg bg-primary/8 ring-1 ring-primary/30"
          transition={SPRING_LAYOUT}
        />
      )}
      <button
        type="button"
        className="absolute inset-0 rounded-lg outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${day.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}${total ? `, ${total} Termine` : ""}`}
        onClick={() => onSelect(day)}
        onDoubleClick={() => onCreate(day)}
      />
      <div className="pointer-events-none relative flex flex-col gap-1">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
            !inMonth && "text-muted-foreground/50",
            isToday && "bg-primary font-semibold text-primary-foreground",
          )}
        >
          {day.getDate()}
        </span>
        {visibleRollouts.map((rollout) => (
          <button
            key={rollout.id}
            type="button"
            title={rollout.title}
            onClick={() => onEdit(rollout)}
            className="pointer-events-auto truncate rounded-md bg-primary/12 px-1.5 py-0.5 text-left text-[11px] font-medium text-primary outline-none transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {rollout.title}
          </button>
        ))}
        {visibleEvents.map((event) => (
          <span key={event.id} title={event.title} className="flex items-center gap-1 truncate px-1.5 text-[11px] text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-sky-500" />
            <span className="truncate">{event.title}</span>
          </span>
        ))}
        {hidden > 0 && <span className="px-1.5 text-[11px] text-muted-foreground">+{hidden} weitere</span>}
      </div>
    </div>
  );
}
