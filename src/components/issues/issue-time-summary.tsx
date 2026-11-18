import { AnimatePresence, motion } from "motion/react";
import { EASE_OUT } from "@/lib/ease";
import type { IssueTimeSummary } from "@/lib/jira/issue-time";

export function IssueTimeSummaryPanel({ summary }: { summary: IssueTimeSummary }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-2xl border bg-muted/30">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">Ticketzeiten und von Jira gelieferte Gesamtzeiten</caption>
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="p-3 font-medium">Zeitwert</th>
              <th scope="col" className="p-3 font-medium text-balance">Nur dieses Ticket</th>
              <th scope="col" className="p-3 font-medium text-balance">Gesamt laut Jira</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {summary.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="p-3 align-top text-xs font-medium text-muted-foreground">{row.label}</th>
                {([["own", row.own], ["aggregate", row.aggregate]] as const).map(([scope, value]) => (
                  <td key={scope} className="p-3 align-top">
                    <AnimatePresence initial={false} mode="wait">
                      <motion.span key={`${value.state}:${value.text}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: EASE_OUT }} className="block break-words font-medium tabular-nums">{value.text}</motion.span>
                    </AnimatePresence>
                    {value.note && <span className="mt-0.5 block text-xs text-muted-foreground">{value.note}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Gesamtwerte können Unteraufgaben enthalten. Die Ticketzeit nicht erneut dazuaddieren. Fehlende Gesamtwerte bleiben unbekannt; sichtbare Unteraufgaben werden hier nicht summiert.</p>
    </div>
  );
}
