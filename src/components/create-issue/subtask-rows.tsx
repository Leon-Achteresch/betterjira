import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/motion/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubtaskRows } from "@/hooks/jira/use-subtask-rows";
import { EASE_OUT } from "@/lib/ease";
import { SUBTASK_ROW_LIMITS, type SubtaskRowResult, type SubtaskRowsTarget } from "@/lib/jira/subtask-rows";

const RESULTS = { created: "Erstellt", blocked: "Gesperrt", rejected: "Abgelehnt", uncertain: "Unklar", unselected: "Übersprungen" } satisfies Record<SubtaskRowResult["status"], string>;

function SubtaskRowsDraft({ target, singlePending, close }: { target: SubtaskRowsTarget; singlePending: boolean; close: () => void }) {
  const model = useSubtaskRows(target, singlePending);
  const inputId = useId();
  const reduce = useReducedMotion();
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (model.results) resultHeading.current?.focus();
  }, [model.results]);
  const enter = { opacity: 0, y: reduce ? 0 : 6 };
  const transition = { duration: 0.18, ease: EASE_OUT };

  return (
    <motion.section aria-label="Mehrere Unteraufgaben" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition} className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-balance">Mehrere Unteraufgaben</h2>
        <p className="mt-1 wrap-anywhere text-sm text-muted-foreground">{target.parent.key} · {target.parent.summary} · {target.project.name} · {target.type.name}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>Titel der Unteraufgaben</Label>
        <p id={`${inputId}-help`} className="text-sm text-muted-foreground">Ein Titel pro Zeile, bis zu {SUBTASK_ROW_LIMITS.rows} Zeilen und {SUBTASK_ROW_LIMITS.characters} Zeichen insgesamt. Jira kann Standardwerte ergänzen.</p>
        <Textarea id={inputId} aria-describedby={`${inputId}-help`} rows={4} value={model.text} onChange={(event) => model.setText(event.target.value)} readOnly={model.submitted} className="min-h-24 max-h-56" />
      </div>
      <div className="flex flex-wrap gap-2">
        {!model.submitted && <Button type="button" variant={model.preview ? "outline" : "default"} onClick={model.inspect} disabled={model.waiting}>Vorschau prüfen</Button>}
        <Button type="button" variant="outline" onClick={close} disabled={model.busy}>Entwurf schließen</Button>
      </div>
      <AnimatePresence initial={false}>
        {model.waiting && <motion.p key="checking" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition} className="text-sm text-muted-foreground">Jira-Ziel wird geprüft…</motion.p>}
        {model.previewFailed && <motion.p key="failed" role="alert" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition} className="text-sm text-destructive">Die Vorschau konnte nicht geprüft werden.</motion.p>}
        {model.preview && !model.submitted && (
          <motion.div key="preview" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition} className="space-y-3">
            {model.preview.problem && <p role="alert" className="text-sm text-destructive">{model.preview.problem}</p>}
            {model.preview.rows.length > 0 && (
              <ul aria-label="Vorschau je Unteraufgabenzeile" className="divide-y rounded-xl border bg-background/40 px-3">
                {model.preview.rows.map((row) => (
                  <li key={row.line} className="min-w-0 py-2 text-sm wrap-anywhere">
                    {model.writable && !model.preview?.problem && !row.problem ? (
                      <Checkbox label={`${row.line}. ${row.title}`} checked={model.selected.includes(row.line)} onCheckedChange={(checked) => model.select(row.line, checked)} className="min-h-8 max-w-full [&_button]:size-8 [&_button]:rounded-xl" />
                    ) : <p className="tabular-nums">{row.line}. {row.title || "Leere Zeile"}</p>}
                    {row.problem && <p className="text-muted-foreground">{row.problem}</p>}
                  </li>
                ))}
              </ul>
            )}
            {!model.writable && !model.preview.problem && <p role="status" className="text-sm text-muted-foreground">Diese Ansicht erstellt keine Tickets. Einzelne Unteraufgaben kannst du im Formular erstellen.</p>}
            {model.writable && !model.preview.problem && (
              <Button type="button" onClick={model.submit} disabled={!model.canSubmit}>
                {model.selected.length === 1 ? "1 Unteraufgabe verbindlich erstellen" : `${model.selected.length} Unteraufgaben verbindlich erstellen`}
              </Button>
            )}
          </motion.div>
        )}
        {model.busy && <motion.p key="submit" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition} className="text-sm text-muted-foreground">Ausgewählte Zeilen werden einzeln geprüft und abgegeben…</motion.p>}
        {model.failed && <motion.p key="submit-failed" role="alert" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition} className="text-sm text-destructive">Ergebnisse konnten nicht bestätigt werden. Prüfe das übergeordnete Ticket vor einer erneuten Abgabe.</motion.p>}
        {model.results && (
          <motion.div key="results" initial={enter} animate={{ opacity: 1, y: 0 }} transition={transition} className="space-y-2">
            <h3 ref={resultHeading} tabIndex={-1} className="text-sm font-medium">Ergebnisse der Abgabe</h3>
            <ul aria-label="Ergebnisse je Unteraufgabenzeile" className="divide-y rounded-xl border bg-background/40 px-3">
              {model.results.map((row) => (
                <li key={row.line} className="py-2 text-sm wrap-anywhere">
                  <p className="tabular-nums">{row.line}. {row.title || "Leere Zeile"} · {RESULTS[row.status]}</p>
                  {row.status === "created" ? <Link to="/issue/$key" params={{ key: row.issueKey }} className="inline-flex min-h-8 items-center underline underline-offset-4">{row.issueKey}</Link> : <p className="text-muted-foreground">{row.message}</p>}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

export function SubtaskRows({ target, singlePending }: { target: SubtaskRowsTarget; singlePending: boolean }) {
  const [open, setOpen] = useState(false);
  const area = useId();
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-col gap-3">
      <Button ref={opener} type="button" variant="outline" aria-expanded={open} aria-controls={area} aria-disabled={open} onClick={() => setOpen(true)} className="self-start">
        Mehrere Unteraufgaben vorbereiten
      </Button>
      <div id={area} hidden={!open}>
        {open && <SubtaskRowsDraft target={target} singlePending={singlePending} close={() => {
          setOpen(false);
          opener.current?.focus();
        }} />}
      </div>
    </div>
  );
}
