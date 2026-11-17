import { AnimatePresence } from "motion/react";
import { Link2Icon } from "lucide-react";
import { Fade } from "@/components/motion/fade";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MultiTicketLinksState } from "@/hooks/jira/use-multi-ticket-links";
import { useVisibleItems } from "@/hooks/use-visible-items";
import { cn } from "@/lib/utils";

export function MultiTicketLinks({ state }: { state: MultiTicketLinksState }) {
  const rows = useVisibleItems(state.preview?.rows ?? [], 5);
  return (
    <Popover open={state.open} onOpenChange={state.setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "mt-2 self-start text-xs",
            state.open && "sticky bottom-4 z-10",
          )}
          disabled={state.pending}
        >
          <Link2Icon className="size-3.5" />
          Mehrere Tickets verknüpfen
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-[min(28rem,calc(100vw-2rem))] gap-3 p-4"
        aria-label="Mehrere Tickets verknüpfen"
      >
        <div className="space-y-1">
          <h2 className="font-medium text-balance">
            Mehrere Tickets verknüpfen
          </h2>
          <p className="text-xs text-muted-foreground break-words">
            Quelle: {state.source}
            <br />
            {state.account}
          </p>
        </div>
        {state.metadataLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : state.metadataError ? (
          <div role="alert" className="space-y-2 text-xs text-destructive">
            <p>{state.metadataError}</p>
            <Button
              type="button"
              variant="outline"
              onClick={state.retryMetadata}
            >
              Typen neu laden
            </Button>
          </div>
        ) : (
          <>
            {state.noTypes && (
              <p role="status" className="text-xs text-muted-foreground">
                Keine eindeutig verwendbaren Jira-Beziehungstypen verfügbar.
                Typen müssen vollständige Richtungsangaben liefern.
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="multi-link-type">
                Quelle steht zu den Zielen in Beziehung…
              </Label>
              <Select
                value={state.choiceId}
                onValueChange={state.setChoice}
                disabled={state.pending}
              >
                <SelectTrigger id="multi-link-type" className="w-full">
                  <SelectValue placeholder="Beziehung und Richtung wählen" />
                </SelectTrigger>
                <SelectContent>
                  {state.choices.map((choice) => (
                    <SelectItem key={choice.id} value={choice.id}>
                      {choice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-2 text-xs text-muted-foreground"
                onClick={state.retryMetadata}
                disabled={state.pending}
              >
                Typen neu laden
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="multi-link-targets">Explizite Zielkeys</Label>
              <Textarea
                id="multi-link-targets"
                value={state.input}
                onChange={(event) => state.setInput(event.target.value)}
                disabled={state.pending}
                placeholder="DEMO-2, DEMO-3"
                rows={3}
                className="min-h-20 text-sm"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Maximal 20 eindeutige Keys. Trennen mit Leerzeichen, Komma,
                Semikolon oder neuer Zeile. Nur diese Ziele werden lesend
                geprüft.
              </p>
            </div>
            {state.inputError && (
              <p role="alert" className="text-xs text-destructive">
                {state.inputError}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={state.requestPreview}
              disabled={!state.canPreview}
            >
              {state.checking ? "Wird lesend geprüft…" : "Vorschau prüfen"}
            </Button>
          </>
        )}
        <AnimatePresence initial={false} mode="wait">
          {state.checking ? (
            <Fade key="checking">
              <div
                role="status"
                aria-label="Ziele werden geprüft"
                className="space-y-2"
              >
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-20 w-full" />
              </div>
            </Fade>
          ) : state.preview ? (
            <Fade key="preview">
              <div className="min-w-0 space-y-3">
                <p className="text-sm font-medium break-words">
                  {state.preview.directionLabel}
                </p>
                <p className="text-xs text-muted-foreground break-words">
                  {state.preview.source.summary}
                </p>
                {state.preview.unreadable > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {state.preview.unreadable} vorhandene Beziehungen sind nicht
                    vollständig lesbar. Die Doppelprüfung kann unvollständig
                    sein.
                  </p>
                )}
                <p className="text-xs text-muted-foreground tabular-nums">
                  {state.preview.ready} von {state.preview.total} Zielen zur
                  Abgabe geprüft
                </p>
                {state.resultSummary && (
                  <p
                    role="status"
                    className="text-xs leading-relaxed tabular-nums"
                  >
                    {state.resultSummary}
                  </p>
                )}
                <ul
                  aria-label="Geprüfte Zielmenge"
                  className="max-h-56 space-y-2 overflow-y-auto rounded-xl bg-muted/40 p-3 text-xs"
                >
                  {rows.visible.map((row) => (
                    <li
                      key={row.key}
                      className="min-w-0 space-y-0.5 break-words"
                    >
                      <span className="font-medium tabular-nums">
                        {row.key}
                      </span>
                      <p className="text-muted-foreground">{row.summary}</p>
                      <p>
                        {row.result?.label ??
                          (row.reason ? "Nicht vorgesehen" : "Bereit")}
                      </p>
                      <p className="text-muted-foreground">
                        {row.result?.message ?? row.reason}
                      </p>
                    </li>
                  ))}
                </ul>
                {rows.canExpand && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs"
                    aria-expanded={rows.expanded}
                    onClick={rows.toggle}
                  >
                    {rows.expanded ? "Weniger anzeigen" : "Alle Ziele anzeigen"}
                  </Button>
                )}
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Einzellinks, maximal zwei gleichzeitig. Keine gemeinsame
                  Transaktion, kein Rollback und keine automatische
                  Wiederholung. Ein unklarer Ausgang bleibt bis zur Prüfung in
                  Jira unklar.
                </p>
                <Button
                  type="button"
                  className="w-full"
                  onClick={state.confirm}
                  disabled={!state.canConfirm}
                >
                  Geprüfte Verknüpfungen bestätigen
                </Button>
              </div>
            </Fade>
          ) : null}
        </AnimatePresence>
        {state.writing && (
          <Button type="button" variant="outline" onClick={state.stop}>
            Weitere Abgaben stoppen
          </Button>
        )}
        {state.pending && !state.checking && !state.writing && (
          <p role="status" className="text-xs text-muted-foreground">
            Vorheriger Lauf wird beendet.
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-xs leading-relaxed text-destructive">
            {state.error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
