import { AnimatePresence } from "motion/react";
import { PersonLabel } from "@/components/people/person-label";
import { Fade } from "@/components/motion/fade";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { ComponentLeadsState } from "@/hooks/jira/use-component-leads";

export function ComponentLeadHints({ state }: { state: ComponentLeadsState }) {
  if (!state.visible) return null;
  return (
    <Popover open={state.open} onOpenChange={state.setOpen}>
      <PopoverTrigger asChild><Button type="button" size="sm" variant="ghost" disabled={state.disabled} className="mt-1 min-h-8 rounded-xl text-xs">Komponentenleitung ansehen</Button></PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl" aria-label="Hinterlegte Komponentenleitungen" onEscapeKeyDown={(event) => event.stopPropagation()}>
        <p className="text-sm font-medium text-balance">Hinterlegte Komponentenleitungen · {state.projectLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">Rollenhinweis aus Jira, keine Festlegung des Bearbeiters. Mehrere Komponenten haben keinen hier bestimmten Vorrang.</p>
        <AnimatePresence initial={false} mode="wait">
          {state.loading ? <Fade key="loading"><Skeleton className="mt-3 h-20 rounded-xl" /></Fade> : (
            <Fade key="roles">
              {state.error && <p role="alert" className="mt-2 text-xs text-destructive">{state.error}</p>}
              <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto" aria-label="Rollen je ausgewählter Komponente">
                {state.rows.map((row) => <li key={row.id} className="rounded-xl bg-muted/50 p-2">
                  <p className="mb-1 break-words text-xs font-medium">{row.name}</p>
                  {row.person ? <PersonLabel {...row.person} size="sm" /> : <p className="text-xs text-muted-foreground">{row.message}</p>}
                </li>)}
              </ul>
              {state.invalid > 0 && <p className="mt-2 text-xs text-muted-foreground">{state.invalid} Komponentenangaben haben keine lesbare ID. Dafür wird keine Leitung angenommen.</p>}
            </Fade>
          )}
        </AnimatePresence>
        <Button type="button" variant="outline" size="sm" className="mt-3 min-h-8 rounded-xl" disabled={!state.canRefresh} onClick={state.refresh}>Rollen neu prüfen</Button>
      </PopoverContent>
    </Popover>
  );
}
