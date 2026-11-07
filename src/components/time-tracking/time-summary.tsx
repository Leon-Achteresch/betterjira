import { ClockIcon, ListIcon, SearchIcon, TicketIcon } from "lucide-react";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Stagger } from "@/components/motion/stagger";
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
  return (
    <Stagger className={cn("grid grid-cols-2 gap-3", matches ? "sm:grid-cols-4" : "sm:grid-cols-3")} aria-label="Summen">
      <StatTile className={cn(!matches && "col-span-2 sm:col-span-1")} icon={<ClockIcon />} label={totalLabel} value={total} hint={hint} />
      {matches && <StatTile icon={<SearchIcon />} label={matches.label} value={matches.total} hint={matches.hint} />}
      <StatTile icon={<ListIcon />} label="Buchungen" value={entries} />
      <StatTile icon={<TicketIcon />} label="Tickets" value={issues} />
    </Stagger>
  );
}
