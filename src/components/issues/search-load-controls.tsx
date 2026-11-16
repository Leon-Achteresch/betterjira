import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { Button } from "@/components/ui/button";
import type { SearchLoadState } from "@/hooks/jira/use-search-load";

export function SearchLoadControls({ state }: { state: SearchLoadState }) {
  return (
    <AnimatePresence initial={false}>
      {state.visible && (
        <Fade>
          <section aria-label="Suchtreffer gesammelt laden" className="flex flex-col gap-2 rounded-2xl border p-3 text-xs text-muted-foreground">
            <p>{state.limits} Danach die vorhandene Tabellenkopie selbst auslösen.</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" className="min-h-8 rounded-xl" disabled={!state.canStart} onClick={state.start}>Übrige Treffer begrenzt laden</Button>
              {state.pending && <Button type="button" variant="outline" size="sm" className="min-h-8 rounded-xl" onClick={state.stop}>Nachladen abbrechen</Button>}
              <span className="tabular-nums">{state.loaded} eindeutige Treffer · {state.pages} weitere Seiten</span>
            </div>
            {state.message && <p role="status">{state.message}</p>}
            {state.duplicates > 0 && <p>{state.duplicates} doppelte Treffer nicht erneut angezeigt. Der Bestand kann sich verändert haben.</p>}
            <p>Geladene oder ausgewählte Treffer können weiterhin bewusst kopiert werden. Keine Momentaufnahme- oder Exportvollständigkeitsgarantie.</p>
          </section>
        </Fade>
      )}
    </AnimatePresence>
  );
}
