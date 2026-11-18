import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CreateIssueForm } from "@/hooks/jira/use-create-issue-form";
import { EASE_OUT } from "@/lib/ease";

export function TemplateApplicationNotice({ report }: { report: CreateIssueForm["templateReport"] }) {
  return (
    <AnimatePresence initial={false}>
      {report && (
        <motion.div key={`${report.templateId}:${report.targetLabel}`} role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }} transition={{ duration: 0.15, ease: EASE_OUT }} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Vorlage „{report.templateName}“ {report.appliedFields?.length ? "angewendet auf" : "geprüft für"} {report.targetLabel}.</span>
          {report.skipped.length > 0 && (
            <Popover>
              <PopoverTrigger asChild><Button type="button" variant="outline" size="sm" className="min-h-8 rounded-xl">Nicht angewendet: <span className="tabular-nums">{report.skipped.length}</span></Button></PopoverTrigger>
              <PopoverContent align="start" className="max-h-80 w-96 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl" aria-label="Nicht angewendete Vorlagenwerte">
                <h3 className="font-medium text-balance">Nicht angewendete Werte</h3>
                <p className="mt-1 text-xs text-muted-foreground">Die Originalwerte bleiben hier und in der Quellvorlage erhalten. Gültige vorhandene Zieleingaben wurden dafür nicht gelöscht.</p>
                <ul className="mt-3 flex flex-col gap-3">
                  {report.skipped.map((entry) => (
                    <li key={entry.fieldId} className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">{entry.label}</p>
                      <p className="text-xs text-muted-foreground">{entry.reason}</p>
                      <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted p-2 text-xs">{entry.displayValue}</pre>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
