import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { IssuePreviewTooltip } from "@/components/issues/issue-preview";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { CreationHintsState } from "@/hooks/jira/use-creation-hints";

export function CreationHints({ state }: { state: CreationHintsState }) {
  return (
    <div>
      <Popover open={state.open} onOpenChange={state.setOpen}>
        <PopoverTrigger asChild><Button type="button" variant="ghost" size="sm" className="min-h-8 rounded-xl" disabled={!state.canStart}>Ähnliche Anliegen suchen</Button></PopoverTrigger>
        <PopoverContent align="start" aria-label="Hinweise auf ähnliche Anliegen" className="w-[min(30rem,calc(100vw-2rem))] rounded-2xl">
          <p className="font-medium text-balance">Vorhandene Anliegen prüfen</p>
          <p className="text-xs text-muted-foreground">Treffer sind Suchhinweise, keine bestätigten Duplikate. Die Suche ändert den Entwurf nicht und sperrt die Erstellung nicht.</p>
          <p className="text-xs text-muted-foreground">Quelle: {state.accountLabel} · Zielprojekt {state.request?.project.key}. Nur Titel, alle sichtbaren Vorgangstypen und Status; zuletzt aktualisierte zuerst.</p>
          <p className="break-words text-xs text-muted-foreground">Jira-Titelsuche mit ODER und Wortanfängen: {state.request?.terms.map((term) => `${term}*`).join(" · ")}. Höchstens {state.limits.words} Titelwörter, eine Suchseite mit maximal {state.limits.results} Treffern. Keine Aussage über andere Projekte oder nicht sichtbare Tickets.</p>
          <AnimatePresence initial={false} mode="wait">
            <Fade key={state.phase}>
              {state.pending && <><Skeleton className="h-24 rounded-xl" /><p role="status" className="mt-2 text-xs">Suche läuft…</p></>}
              {state.phase === "cancelled" && <p role="status" className="text-xs">Suche abgebrochen. Keine Treffer dieses Laufs übernommen.</p>}
              {state.phase === "error" && <p role="alert" className="text-xs text-destructive">Hinweise konnten nicht gelesen werden. Berechtigung, Verbindung oder Suchanfrage konnten nicht bestätigt werden. Der Entwurf bleibt erhalten.</p>}
              {state.result && <>
                <p role="status" className="text-xs tabular-nums">{state.result.rows.length} prüfbare Hinweise aus {state.result.returned} gelieferten Treffern.</p>
                {state.result.omitted > 0 && <p className="text-xs text-muted-foreground">{state.result.omitted} Treffer ohne bestätigtes Zielprojekt oder lesbaren Titel ausgelassen.</p>}
                {state.result.duplicates > 0 && <p className="text-xs text-muted-foreground">{state.result.duplicates} doppelt gelieferte Treffer nur einmal gezeigt.</p>}
                <Stagger role="list" aria-label="Vorhandene Tickets als Suchhinweise" className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {state.result.rows.map((row) => <StaggerItem key={row.key} role="listitem">
                    <IssuePreviewTooltip issueKey={row.key}>
                      <Button type="button" variant="ghost" className="h-auto min-h-8 w-full justify-start rounded-xl px-2 py-2 text-left whitespace-normal" onClick={() => state.openIssue(row.key)}>
                        <span className="min-w-0"><span className="font-mono text-xs text-muted-foreground">{row.key}</span><span className="block break-words text-sm">{row.summary}</span><span className="block text-xs text-muted-foreground">{row.issueType} · {row.status}</span></span>
                      </Button>
                    </IssuePreviewTooltip>
                  </StaggerItem>)}
                </Stagger>
                {state.result.rows.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Keine prüfbaren Hinweise in dieser Suchseite. Das beweist nicht, dass das Anliegen noch nicht existiert.</p>}
                <p className="mt-2 text-xs text-muted-foreground">{state.result.coverage === "page-end" ? "Jira bestätigt das Ende dieser Suchabfrage." : state.result.coverage === "limited" ? "Weitere Suchtreffer möglich; sie werden hier nicht nachgeladen." : "Jira liefert keine bestätigte Angabe zum Suchende."} Kein vollständiger Projektbestand oder unveränderlicher Snapshot.</p>
              </>}
            </Fade>
          </AnimatePresence>
          <Button type="button" variant="outline" size="sm" className="min-h-8 rounded-xl" onClick={state.pending ? state.stop : () => void state.start()} disabled={!state.pending && !state.canStart}>{state.pending ? "Suche abbrechen" : "Erneut bewusst suchen"}</Button>
        </PopoverContent>
      </Popover>
      {state.disabledReason && <p className="mt-1 text-xs text-muted-foreground">{state.disabledReason}</p>}
    </div>
  );
}
