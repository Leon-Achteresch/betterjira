import { useId, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { XIcon } from "lucide-react";
import { Fade } from "@/components/motion/fade";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { EASE_OUT } from "@/lib/ease";
import { useJiraQueryScope } from "@/hooks/jira/use-jira-query-scope";
import { useSelectedWorklogDays } from "@/hooks/time-tracking/use-selected-worklog-days";
import type { WorklogStartWindow } from "@/lib/time-tracking/selected-worklog-days";

type Target = { id: string; key: string; summary: string };
type Seed = { duration: string; started: string };

function RemoveDay({ day, onRemove }: { day: string; onRemove: (day: string) => void }) {
  return (
    <Tooltip content="Tag entfernen">
      <Button type="button" variant="ghost" size="icon-sm" className="size-8" aria-label={`${day} entfernen`} onClick={() => onRemove(day)}>
        <XIcon />
      </Button>
    </Tooltip>
  );
}

function SelectedDaysContent({ target, seed, accountId, loaded, dateInput }: {
  target: Target;
  seed: Seed;
  accountId: string;
  loaded?: WorklogStartWindow;
  dateInput: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  const state = useSelectedWorklogDays(seed, accountId, loaded);
  const plan = state.plan;
  const rows = plan?.rows;
  const removeDay = (day: string) => {
    state.removeDay(day);
    dateInput.current?.focus();
  };
  return (
    <>
      <PopoverTitle className="text-base text-balance">Zeitbuchungen vorbereiten</PopoverTitle>
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{target.key}</span>
        <span className="wrap-anywhere font-medium">{target.summary}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-duration`}>Dauer je Tag</Label>
          <Input id={`${id}-duration`} value={state.duration} placeholder="z. B. 30m"
            onChange={(event) => state.setDuration(event.target.value)} className="min-w-0 rounded-xl" />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-time`}>Lokale Startzeit</Label>
          <Input id={`${id}-time`} type="time" value={state.time}
            onChange={(event) => state.setTime(event.target.value)} className="min-w-0 rounded-xl" />
        </div>
      </div>
      <form className="flex flex-col gap-1.5" onSubmit={(event) => { event.preventDefault(); state.addDay(); }}>
        <Label htmlFor={`${id}-day`}>Einzelnen Tag wählen</Label>
        <div className="flex min-w-0 items-center gap-2">
          <Input id={`${id}-day`} ref={dateInput} type="date" value={state.day}
            onChange={(event) => state.setDay(event.target.value)} className="min-w-0 rounded-xl" />
          <Button type="submit" variant="outline" size="sm" className="min-h-8 shrink-0" disabled={!state.canAddDay}>Tag hinzufügen</Button>
        </div>
      </form>
      <AnimatePresence initial={false}>
        {state.dayError && <Fade key="day-error"><p role="alert" className="text-sm text-destructive">{state.dayError}</p></Fade>}
        {!rows && state.days.length > 0 && (
          <Fade key="days">
            <ul aria-label="Gewählte Tage" className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto overscroll-contain">
              <AnimatePresence initial={false}>
                {state.days.map((day) => (
                  <motion.li key={day} initial={{ opacity: 0, y: reduce ? 0 : 4 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.18, ease: EASE_OUT }}
                    className="flex items-center rounded-xl border pl-2 text-xs tabular-nums">
                      <time dateTime={day}>{day}</time>
                      <RemoveDay day={day} onRemove={removeDay} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </Fade>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between gap-2">
        <span id={`${id}-coverage`} className="text-xs text-muted-foreground">
          {rows && plan.partial ? "Abgleich nur mit geladenen eigenen Buchungen." : "Lokale Vorschau"}
        </span>
        <Button type="button" size="sm" className="min-h-8" disabled={!state.days.length} onClick={state.preview}>Vorschau prüfen</Button>
      </div>
      <AnimatePresence initial={false}>
        {plan?.error && <Fade key="plan-error"><p role="alert" className="text-sm text-destructive">{plan.error}</p></Fade>}
        {rows && (
          <Fade key="preview">
            <section aria-label="Geplante Zeitbuchungen" aria-describedby={`${id}-coverage`}>
              <ul className="max-h-44 divide-y overflow-y-auto overscroll-contain rounded-xl border" aria-label="Geplante Einträge" tabIndex={0}>
                {rows.map(({ day, time, duration, dateTime, offset, problem }) => (
                  <li key={day} className="flex items-center gap-1 px-2.5 py-1 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <time dateTime={dateTime ?? day} className="font-medium tabular-nums">{day} · {time}{offset && ` (UTC${offset})`}</time>
                        <span className="shrink-0 tabular-nums">{target.key} · {duration}</span>
                      </div>
                      {problem && <p className="mt-1 text-warning">{problem}</p>}
                    </div>
                    <RemoveDay day={day} onRemove={removeDay} />
                  </li>
                ))}
              </ul>
            </section>
          </Fade>
        )}
      </AnimatePresence>
    </>
  );
}

function SelectedDaysPopover({ target, seed, accountId, loaded }: {
  target: Target;
  seed: Seed;
  accountId: string;
  loaded?: WorklogStartWindow;
}) {
  const [open, setOpen] = useState(false);
  const dateInput = useRef<HTMLInputElement>(null);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="min-h-8 self-start">Einzelne Tage planen</Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={12} aria-label="Zeitbuchungen vorbereiten"
        className="w-[min(26rem,calc(100vw-1.5rem))] p-3"
        onOpenAutoFocus={(event) => { if (dateInput.current) { event.preventDefault(); dateInput.current.focus(); } }}>
        {open && <SelectedDaysContent target={target} seed={seed} accountId={accountId} loaded={loaded} dateInput={dateInput} />}
      </PopoverContent>
    </Popover>
  );
}

export function WorklogSelectedDays({ target, seed, loaded }: { target: Target; seed: Seed; loaded?: WorklogStartWindow }) {
  const { scope } = useJiraQueryScope();
  if (!scope) return null;
  return <SelectedDaysPopover key={JSON.stringify([scope, target.id, target.key])} target={target} seed={seed} accountId={scope.accountId} loaded={loaded} />;
}
