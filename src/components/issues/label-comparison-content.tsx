import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { EASE_OUT } from "@/lib/ease";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import type { LabelComparisonState } from "@/hooks/use-label-comparison";

export function LabelComparisonContent({ state }: { state: LabelComparisonState }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium text-balance">Ähnliche Labelvarianten vergleichen</p>
        <p className="mt-1 text-xs text-muted-foreground">Ähnlichkeit ist nur ein Hinweis. Prüfe die Bedeutung an den Tickets selbst. Hier wird nichts umbenannt oder zusammengeführt.</p>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground tabular-nums">
        <p>Quelle: {state.inventory.sourceCount} {state.sourceLabel} · {state.accountLabel}</p>
        <p>{state.inventory.labels.length} Schreibweisen aus {state.inventory.checked} geprüften Tickets. Häufigkeiten gelten nur für diese geprüfte Menge.</p>
        <p>Kein vollständiger Jira-Projektbestand. Hier werden keine weiteren Suchseiten geladen.</p>
        {state.hasMore && <p>Weitere Suchtreffer sind noch nicht geladen.</p>}
        {state.readError && <p role="alert">Lesefehler in der Suche: Verglichen wird nur der bereits geladene Stand.</p>}
        {state.inventory.unreadable > 0 && <p>{state.inventory.unreadable} Tickets ohne lesbares Labelfeld; fehlend bedeutet nicht leer.</p>}
        {state.inventory.invalid > 0 && <p>{state.inventory.invalid} ungültige Labelangaben ausgelassen.</p>}
        {(state.inventory.limitedIssues > 0 || state.inventory.omitted > 0) && <p>Vergleich begrenzt: höchstens {state.limits.issues} Einträge, {state.limits.labelsPerIssue} Labels je Ticket und {state.limits.labels} Schreibweisen. {state.inventory.limitedIssues} Einträge und {state.inventory.omitted} Labelangaben ausgelassen; Häufigkeiten können unvollständig sein.</p>}
      </div>
      <Label htmlFor="label-comparison-reference">Ausgangslabel wählen</Label>
      <Combobox items={state.labels} value={state.reference} onValueChange={state.setReference}>
        <ComboboxInput id="label-comparison-reference" placeholder="Geladenes Label suchen…" showTrigger={false} className="w-full rounded-xl" />
        <ComboboxContent className="rounded-2xl">
          <ComboboxEmpty>Keine passende geladene Schreibweise</ComboboxEmpty>
          <ComboboxList>{(label: string) => <ComboboxItem key={label} value={label} className="min-h-8 rounded-xl break-all">{label}</ComboboxItem>}</ComboboxList>
        </ComboboxContent>
      </Combobox>
      <AnimatePresence initial={false} mode="wait">
        <Fade key={state.reference ?? "empty"}>
          {state.comparison.selected ? (
            <>
              <p className="break-all text-sm font-medium">Ausgangslabel: {state.comparison.selected.label}</p>
              <p className="text-xs text-muted-foreground tabular-nums">In {state.comparison.selected.count} geprüften Tickets · Beispiele: {state.comparison.selected.examples.join(", ")}</p>
              <p role="status" className="mt-2 text-xs tabular-nums">{state.comparison.matches.length} von {state.comparison.totalMatches} ähnlichen Schreibweisen. Groß-/Kleinschreibung, Trennzeichen und ab fünf Zeichen ein einzelner Zeichenunterschied werden geprüft. Keine Synonymerkennung.</p>
              <Stagger role="list" className="mt-2 max-h-52 space-y-2 overflow-y-auto" aria-label="Schreibweisen zum manuellen Vergleich">
                <AnimatePresence initial={false}>
                {state.comparison.matches.map((entry) => <StaggerItem role="listitem" key={entry.label} exit={{ opacity: 0 }} transition={{ duration: 0.12, ease: EASE_OUT }} className="rounded-xl bg-muted/50 p-2">
                  <p className="break-all text-sm font-medium">{entry.label}</p>
                  <p className="text-xs text-muted-foreground">{entry.reason}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">In {entry.count} geprüften Tickets · Beispiele: {entry.examples.join(", ")}</p>
                </StaggerItem>)}
                </AnimatePresence>
              </Stagger>
              {state.comparison.totalMatches === 0 && <p className="text-xs text-muted-foreground">In dieser begrenzten Menge keine ähnliche Schreibweise gefunden. Das belegt keine eindeutige Bedeutung oder vollständige Bereinigung.</p>}
            </>
          ) : <p className="text-xs text-muted-foreground">Wähle eine geladene Schreibweise für den Vergleich. Eine leere Liste kann auch durch fehlende Felder oder die begrenzte Datenmenge entstehen.</p>}
        </Fade>
      </AnimatePresence>
      <p className="text-xs text-muted-foreground">Nach der fachlichen Prüfung kannst du die bestehende Labelsuche, Ticketauswahl und „Bearbeiten“ verwenden. Der Vergleich übernimmt keine Werte in eine Änderung.</p>
    </div>
  );
}
