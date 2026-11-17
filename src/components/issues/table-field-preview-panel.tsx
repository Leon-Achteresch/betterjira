import { useId } from "react";
import { Fade } from "@/components/motion/fade";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useTableFieldPreview, type TableFieldPreviewContext } from "@/hooks/jira/use-table-field-preview";
import { TABLE_FIELD_LIMITS, type TableFieldRow } from "@/lib/jira/table-field-preview";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<TableFieldRow["status"], string> = {
  change: "Änderung möglich",
  unchanged: "Bereits derselbe Wert",
  columns: "Mehrdeutig: mehr als zwei Spalten",
  "missing-key": "Ticketschlüssel fehlt",
  "invalid-key": "Ungültiger Ticketschlüssel",
  duplicate: "Ticketschlüssel steht mehrfach in der Tabelle",
  "outside-selection": "Ticket ist nicht ausgewählt",
  ambiguous: "Ticket in der Auswahl nicht eindeutig",
  "missing-value": "Fälligkeit fehlt. Leerwerte ändern nichts.",
  "invalid-date": "Ungültige Fälligkeit. Erwartet wird JJJJ-MM-TT.",
  "different-issue": "Ticketzuordnung hat sich geändert",
  "missing-issue": "Ticket fehlt oder ist für dieses Konto nicht sichtbar",
  forbidden: "Rechte zum Bearbeiten oder Planen fehlen",
  unsupported: "Fälligkeit ist für dieses Ticket nicht bearbeitbar",
  "missing-current": "Jira hat die aktuelle Fälligkeit nicht geliefert",
  "invalid-current": "Jira hat eine ungültige Fälligkeit geliefert",
  "read-error": "Fälligkeit, Rechte oder Bearbeitungsdaten konnten nicht geprüft werden",
};
const focusSummary = (summary: HTMLParagraphElement | null) => summary?.focus();

function PreviewRow({ row }: { row: TableFieldRow }) {
  const checked = row.status === "change" || row.status === "unchanged";
  return (
    <li className="min-w-0 rounded-xl border border-border/60 bg-muted/40 p-2.5">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">Zeile {row.line}</span>
        <span className="min-w-0 break-all font-mono text-xs font-medium">{row.key || "Ohne Schlüssel"}</span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs tabular-nums">
        <div className="min-w-0">
          <dt className="text-muted-foreground">Aktuell</dt>
          <dd>{row.before === null ? "Ohne Fälligkeit" : row.before ?? "–"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Tabellenwert</dt>
          <dd className="truncate" title={row.value}>{row.value || "–"}</dd>
        </div>
      </dl>
      <p className={cn("mt-2 text-xs", checked ? "text-muted-foreground" : "text-destructive")}>{STATUS_LABELS[row.status]}</p>
    </li>
  );
}

export function TableFieldPreviewPanel({ context }: { context: TableFieldPreviewContext }) {
  const state = useTableFieldPreview(context);
  const id = useId();
  const { preview } = state;
  const changed = preview?.rows.filter((row) => row.status === "change").length ?? 0;
  const unchanged = preview?.rows.filter((row) => row.status === "unchanged").length ?? 0;
  return (
    <Fade>
      <div className="flex flex-col gap-3">
        <p className="break-words text-xs text-muted-foreground">{context.accountLabel} · {context.targets.length} ausgewählt</p>
        <div className="space-y-1.5">
          <Label htmlFor={id}>Tabellenwerte (TSV)</Label>
          <Textarea id={id} aria-describedby={`${id}-help`} aria-invalid={!!state.inputError}
            className="max-h-28 min-h-20 resize-y rounded-xl font-mono text-xs tabular-nums"
            placeholder={"DEMO-1\t2026-12-18"} value={state.input} onChange={(event) => state.setInput(event.target.value)} />
          <p id={`${id}-help`} className="text-xs leading-relaxed text-muted-foreground">
            Ticketschlüssel und Fälligkeit (JJJJ-MM-TT) aus zwei Spalten ohne Kopfzeile einfügen. Bis zu {TABLE_FIELD_LIMITS.rows} Zeilen.
          </p>
        </div>
        <Button type="button" className="min-h-8 rounded-xl" disabled={!state.canPreview} onClick={state.requestPreview}>Vorschau prüfen</Button>
        {state.inputError && <Fade><p role="alert" className="text-xs text-destructive">{state.inputError}</p></Fade>}
        {state.readError && <Fade><p role="alert" className="text-xs text-destructive">Der Jira-Kontext konnte nicht bestätigt werden. Vorschau erneut prüfen.</p></Fade>}
        {state.pending && <Fade><Skeleton role="status" aria-label="Tabellenwerte werden geprüft" className="h-16 rounded-xl" /></Fade>}
        {preview && (
          <Fade>
            <p ref={focusSummary} role="status" tabIndex={-1} className="rounded-sm text-xs font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {changed} mit Änderung · {unchanged} unverändert · {preview.rows.length - changed - unchanged} mit Klärungsbedarf
              {preview.unmatched > 0 && ` · ${preview.unmatched} ohne Tabellenzeile`}
            </p>
            <ol aria-label="Prüfung je Tabellenzeile" className="mt-2 space-y-2">
              {preview.rows.map((row) => <PreviewRow key={row.line} row={row} />)}
            </ol>
          </Fade>
        )}
      </div>
    </Fade>
  );
}
