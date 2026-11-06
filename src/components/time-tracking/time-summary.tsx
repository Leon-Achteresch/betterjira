import { ClockIcon, ListIcon, TicketIcon } from "lucide-react";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Stagger } from "@/components/motion/stagger";

export function TimeSummaryTiles({
  total,
  totalLabel,
  entries,
  issues,
  hint,
}: {
  total: string;
  totalLabel: string;
  entries: number;
  issues: number;
  hint?: string;
}) {
  return (
    <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Summen">
      <StatTile className="col-span-2 sm:col-span-1" icon={<ClockIcon />} label={totalLabel} value={total} hint={hint} />
      <StatTile icon={<ListIcon />} label="Buchungen" value={entries} />
      <StatTile icon={<TicketIcon />} label="Tickets" value={issues} />
    </Stagger>
  );
}
