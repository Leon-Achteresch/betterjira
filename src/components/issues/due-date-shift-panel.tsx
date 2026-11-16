import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { DueDateShiftState } from "@/hooks/jira/use-due-date-shift";

export function DueDateShiftPanel({ state }: { state: DueDateShiftState }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="break-words text-xs text-muted-foreground">{state.accountLabel}</p>
      <div>
        <Label htmlFor="bulk-due-days">Versatz in Kalendertagen</Label>
        <Input id="bulk-due-days" className="mt-2 rounded-xl tabular-nums" value={state.input} placeholder="z. B. 7 oder -3" disabled={state.pending}
          aria-describedby="bulk-due-help" aria-invalid={!!state.inputError} onChange={(event) => state.setInput(event.target.value)} />
        <p id="bulk-due-help" className="mt-1 text-xs text-muted-foreground">Positive Zahl: später. Negative Zahl: früher. Fehlende Fälligkeiten bleiben leer.</p>
        {state.inputError && <p role="alert" className="mt-1 text-xs text-destructive">{state.inputError}</p>}
      </div>
      <Button type="button" variant="outline" className="min-h-8 rounded-xl" disabled={!state.canPreview} onClick={state.requestPreview}>Vorschau frisch prüfen</Button>
      {state.waitingPrevious && <p role="status" className="text-xs text-muted-foreground">Der vorherige Lauf wird beendet. Weitere Änderungen bleiben bis dahin gesperrt.</p>}
      <AnimatePresence initial={false} mode="wait">
        {state.checking && <Fade key="loading"><Skeleton aria-label="Vorschau wird geprüft" className="h-24 rounded-xl" /></Fade>}
        {state.preview && (
          <Fade key="preview">
            <p className="text-sm font-medium text-balance tabular-nums">{state.preview.readyCount} Fälligkeiten um {state.preview.days} Kalendertage verschieben</p>
            <ul aria-label="Vorschau der Fälligkeiten" className="mt-2 max-h-60 space-y-2 overflow-y-auto text-xs">
              {state.preview.rows.map((row) => (
                <li key={row.key} className="rounded-xl bg-muted p-2">
                  <p className="font-medium">{row.key}</p>
                  <p className="break-words tabular-nums">{row.beforeLabel} → {row.afterLabel}</p>
                  {row.reason && <p className="mt-1 text-muted-foreground">Wird ausgelassen: {row.reason}</p>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Vor dem Schreiben wird erneut geprüft. Abweichungen werden ausgelassen. Teiländerungen sind möglich; kein automatisches Rückgängigmachen.</p>
            <Button type="button" className="mt-3 min-h-8 w-full rounded-xl" disabled={!state.canConfirm} onClick={state.confirm}>Verschiebung bestätigen</Button>
          </Fade>
        )}
      </AnimatePresence>
      {state.writing && (
        <Fade>
          <p role="status" className="text-xs text-muted-foreground">Fälligkeiten werden einzeln geprüft und geschrieben. Stoppen betrifft nur noch nicht gesendete Änderungen.</p>
          <Button type="button" variant="outline" size="sm" className="mt-2 min-h-8 rounded-xl" onClick={state.stop}>Weitere Änderungen stoppen</Button>
        </Fade>
      )}
      {state.error && <Fade><p role="alert" className="text-xs text-destructive">{state.error}</p></Fade>}
      {state.results.length > 0 && (
        <Fade>
          <p className="text-sm font-medium text-balance">Ergebnis je Ticket</p>
          <ul aria-label="Ergebnisse der Fälligkeitsverschiebung" className="mt-2 max-h-60 space-y-2 overflow-y-auto text-xs">
            {state.results.map((result) => (
              <li key={result.row.key} className="min-w-0 break-words">
                <p className="font-medium">{result.row.key} · {result.label}</p>
                <p className="tabular-nums">Geplant: {result.beforeLabel} → {result.afterLabel}</p>
                <p className="text-muted-foreground">{result.message}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Kein automatischer Wiederholungsversuch. Für eine weitere Verschiebung neue Vorschau prüfen und bewusst bestätigen; bereits geänderte Termine können dann erneut verschoben werden.</p>
        </Fade>
      )}
    </div>
  );
}
