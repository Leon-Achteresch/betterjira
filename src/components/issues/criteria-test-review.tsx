import { useId, useRef } from "react";
import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { CriteriaTestReviewState } from "@/hooks/jira/use-criteria-test-review";

const SELECT = "min-h-9 w-full min-w-0 rounded-xl border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
const CRITERIA_HINT = "Erwartet wird eine Liste unter „Akzeptanzkriterien“ oder „Acceptance Criteria“.";

export function CriteriaTestReview({ state, loadingLinks }: { state: CriteriaTestReviewState; loadingLinks: boolean }) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const { criteria, candidates } = state;

  return (
    <Popover key={state.context} open={state.open} onOpenChange={state.setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="min-h-8 self-start text-muted-foreground" disabled={loadingLinks}>Kriterium und Testbezug prüfen</Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        aria-labelledby={`${id}-title`}
        className="w-[min(29rem,calc(100vw-1.5rem))] gap-3 p-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          heading.current?.focus();
        }}
      >
        <PopoverHeader>
          <h2 id={`${id}-title`} ref={heading} tabIndex={-1} className="font-medium text-balance outline-none">Kriterium und Testbezug prüfen</h2>
          <PopoverDescription className="text-xs">Lokale Vorschau. Die Auswahl gilt bis zum Schließen. Testabdeckung und Testergebnis bleiben ungeprüft.</PopoverDescription>
        </PopoverHeader>
        {!state.available && <p role="status" className="text-xs text-muted-foreground">Der Ticket- oder Kontokontext ist noch nicht bestätigt.</p>}
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${id}-criterion`}>Kriterium aus der Beschreibung</Label>
          <select id={`${id}-criterion`} className={SELECT} value={state.criterion?.line ?? ""} onChange={(event) => state.selectCriterion(event.target.value)} disabled={!criteria.rows.length}>
            <option value="">Kriterium wählen</option>
            {criteria.rows.map(({ line, text }) => <option key={line} value={line}>{line}. {text}</option>)}
          </select>
          {criteria.kind !== "list" && <p className="text-xs text-muted-foreground">{criteria.kind === "missing" ? "Keine Kriterienliste gefunden." : "Die Kriterienstruktur ist nicht eindeutig."} {CRITERIA_HINT}</p>}
          {criteria.excluded > 0 && <p className="text-xs text-muted-foreground">{criteria.excluded} mehrdeutige oder nicht unterstützte Listeneinträge fehlen in der Auswahl.</p>}
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${id}-link`}>Vorhandene Testverknüpfung</Label>
          <select id={`${id}-link`} className={SELECT} value={state.target?.reference.id ?? ""} onChange={(event) => state.selectTarget(event.target.value)} disabled={!candidates.length}>
            <option value="">Verknüpfung wählen</option>
            {candidates.map(({ key, reference }) => <option key={reference.id} value={reference.id}>{key} · {reference.directed?.inward}</option>)}
          </select>
          {!candidates.length && <p className="text-xs text-muted-foreground">{state.linkListRead ? "Keine eindeutige Testverknüpfung in den sichtbaren Jira-Links." : "Die vorhandenen Jira-Verknüpfungen sind noch nicht bestätigt."}</p>}
        </div>
        <AnimatePresence initial={false} mode="wait">
          {state.loading ? (
            <Fade key="loading">
              <div role="status" aria-label="Kriterium und verknüpftes Ticket werden geprüft" className="space-y-2 py-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </Fade>
          ) : state.error ? (
            <Fade key="error"><p role="alert" className="text-xs text-destructive">{state.error}</p></Fade>
          ) : state.result ? (
            <Fade key="result">
              <section aria-label="Lokale Vorschau der Auswahl" className="space-y-2 rounded-2xl border bg-muted/40 p-3 text-sm wrap-anywhere">
                <p className="text-xs font-medium text-muted-foreground">Lokale Vorschau</p>
                <p><span className="font-mono text-xs">{state.result.source}</span> · Kriterium {state.result.criterion.line}</p>
                <p>{state.result.criterion.text}</p>
                <p className="border-t pt-2"><span className="font-mono text-xs">{state.result.test.key}</span> · {state.result.test.type}{state.result.test.summary && ` · ${state.result.test.summary}`}</p>
                <p className="text-xs text-muted-foreground">Jira-Ticketbeziehung: {state.result.relation}</p>
              </section>
            </Fade>
          ) : state.criterion ? (
            <Fade key="selected"><p className="text-xs wrap-anywhere text-muted-foreground">{state.criterion.text}</p></Fade>
          ) : null}
        </AnimatePresence>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => state.setOpen(false)}>Schließen</Button>
          <Button type="button" size="sm" disabled={!state.ready} onClick={state.review}>Auswahl prüfen</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
