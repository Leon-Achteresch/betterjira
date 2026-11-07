import { ClockIcon, ListIcon, SearchIcon, TicketIcon } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Stagger } from "@/components/motion/stagger";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export function TimeSummaryTiles({
  total,
  totalLabel,
  entries,
  issues,
  hint,
  matches,
}: {
  total: string;
  totalLabel: string;
  entries: number;
  issues: number;
  hint?: string;
  matches?: { label: string; total: string; hint: string };
}) {
  const reduce = useReducedMotion();
  return (
    <Stagger className={cn("relative grid grid-cols-2 gap-3", matches ? "sm:grid-cols-4" : "sm:grid-cols-3")} aria-label="Summen">
      <AnimatePresence initial={false} mode="popLayout">
        <StatTile key="total" layout={reduce ? false : "position"} transition={{ layout: SPRING_LAYOUT }} className={cn(!matches && "col-span-2 sm:col-span-1")} icon={<ClockIcon />} label={totalLabel} value={total} hint={hint} />
        {matches && <StatTile key="matches" layout={reduce ? false : "position"} transition={{ layout: SPRING_LAYOUT }} exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }} icon={<SearchIcon />} label={matches.label} value={matches.total} hint={matches.hint} />}
        <StatTile key="entries" layout={reduce ? false : "position"} transition={{ layout: SPRING_LAYOUT }} icon={<ListIcon />} label={matches ? "Buchungen gesamt" : "Buchungen"} value={entries} />
        <StatTile key="issues" layout={reduce ? false : "position"} transition={{ layout: SPRING_LAYOUT }} icon={<TicketIcon />} label={matches ? "Tickets gesamt" : "Tickets"} value={issues} />
      </AnimatePresence>
    </Stagger>
  );
}
