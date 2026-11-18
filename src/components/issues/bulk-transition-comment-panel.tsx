import { useId } from "react";
import { Fade } from "@/components/motion/fade";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { BulkTransitionCommentState } from "@/hooks/jira/use-bulk-transition-comment";
import { BULK_TRANSITION_COMMENT_LIMIT, BULK_TRANSITION_LIMIT, type BulkTransitionResult } from "@/lib/jira/bulk-transition-comment";

const resultLabel: Record<BulkTransitionResult["status"], string> = {
  changed: "Geändert",
  failed: "Abgewiesen",
  uncertain: "Ergebnis unklar",
  skipped: "Gesperrt",
  "context-lost": "Gesperrt",
};

export function BulkTransitionCommentPanel({ state }: { state: BulkTransitionCommentState }) {
  const id = useId();
  if (state.targets.length > BULK_TRANSITION_LIMIT) return (
    <p role="status" className="text-sm">Für diese Vorschau höchstens {BULK_TRANSITION_LIMIT} Vorgänge auswählen.</p>
  );
  if (!state.active) return <p role="status" className="text-sm">Wähle Vorgänge im aktuellen Jira-Konto aus.</p>;

  return (
    <Fade>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`${id}-targets`} className="text-sm font-medium tabular-nums">Ausgewählt: {state.targets.length}</h3>
          <Button type="button" size="sm" variant="outline" className="min-h-8"
            disabled={!state.readyToCheck} onClick={state.requestPreview}>
            {state.checked ? "Erneut prüfen" : "Übergänge prüfen"}
          </Button>
        </div>
        {state.pending && <Skeleton role="status" aria-label="Übergänge werden geprüft" className="h-16 rounded-xl" />}
        {state.readError && <p role="alert" className="text-sm text-destructive">Die Vorschau konnte nicht geladen werden. Übergänge erneut prüfen.</p>}
        {state.checked && state.statuses.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-status`}>Zielstatus</Label>
            <Select value={state.statusId} onValueChange={state.setStatusId} disabled={state.submitted}>
              <SelectTrigger id={`${id}-status`} className="min-h-8 w-full rounded-xl">
                <SelectValue placeholder="Abschlussstatus wählen" />
              </SelectTrigger>
              <SelectContent>
                {state.statuses.map(({ id: statusId, label }) => <SelectItem key={statusId} value={statusId}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {state.checked && state.statuses.length === 0 && (
          <p role="status" className="text-xs text-muted-foreground">Jira hat keinen Abschlussstatus für diese Auswahl geliefert.</p>
        )}
        {!state.submitted && state.checked && state.statusId && (
          <p role="status" className="text-xs tabular-nums text-muted-foreground">
            {state.eligible} von {state.targets.length} für Abschluss mit Kommentar geeignet
          </p>
        )}
        <ul aria-labelledby={`${id}-targets`} tabIndex={0}
          className="max-h-36 min-w-0 divide-y overflow-y-auto overscroll-contain rounded-xl border focus-visible:ring-2 focus-visible:ring-ring sm:max-h-56">
          {state.targets.map(({ key }, index) => {
            const row = state.rows[index];
            const result = state.results.find((entry) => entry.key === key);
            return (
              <li key={key} className="flex min-w-0 flex-col gap-1 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <span className="font-mono font-medium">{key}</span>
                  {!result && row?.current && <span className="text-muted-foreground">{row.current}</span>}
                </div>
                {!result && row?.reason && <span className="text-warning">{row.reason}</span>}
                {!result && row?.eligible && <span className="text-muted-foreground">Geeignet · {row.eligible.transition.name}</span>}
                {row?.fields.map(({ name, required }, fieldIndex) => required.length > 0 && (
                  <p key={fieldIndex} className="wrap-anywhere">Pflichtfelder für {name}: {required.join(", ")}</p>
                ))}
                {result && <p role="status" className="wrap-anywhere"><span className="font-medium">{resultLabel[result.status]}</span> · {result.message}</p>}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-comment`}>Gemeinsame Begründung</Label>
          <Textarea id={`${id}-comment`} rows={3} className="min-h-20 max-h-36 overflow-y-auto rounded-xl" maxLength={BULK_TRANSITION_COMMENT_LIMIT}
            value={state.comment} readOnly={state.submitted} onChange={(event) => state.setComment(event.target.value)} />
          <p className="text-xs text-muted-foreground">
            {state.fixtureApply ? "Derselbe Kommentar wird für jeden bestätigten Vorgang verwendet."
              : "Lokaler Kommentarentwurf. Diese Vorschau sendet keine Änderungen an Jira."}
          </p>
        </div>
        {state.fixtureApply && !state.submitted && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <label className="flex min-h-8 items-center gap-2 text-sm">
              <Checkbox checked={state.approved} disabled={!state.canReview} onCheckedChange={(value) => state.setApproved(value === true)} />
              Geeignete Vorgänge und Kommentar bestätigen
            </label>
            <Button type="button" size="sm" className="min-h-8 self-end" disabled={!state.canApply} onClick={state.apply}>
              Geeignete Vorgänge abschließen
            </Button>
          </div>
        )}
        {state.applying && state.submitted && <p role="status" className="text-xs text-muted-foreground">Bestätigte Vorgänge werden geprüft und abgeschlossen.</p>}
        {state.applyError && <p role="alert" className="text-sm text-destructive">Ausführung unterbrochen. Prüfe den Serverstand vor einer erneuten Freigabe.</p>}
      </div>
    </Fade>
  );
}
