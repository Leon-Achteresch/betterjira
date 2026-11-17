import { AnimatePresence } from "motion/react";
import { Link2Icon, RotateCwIcon } from "lucide-react";
import { Fade } from "@/components/motion/fade";
import { IconAction } from "@/components/motion/icon-action";
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

type Row = NonNullable<MultiTicketLinksState["preview"]>["rows"][number];
type Tone = NonNullable<Row["result"]>["status"] | "ready" | "held";

const DOT: Record<Tone, string> = {
  ready: "bg-foreground/60",
  held: "border border-dashed border-muted-foreground",
  sending: "bg-info ring-3 ring-info/20",
  confirmed: "bg-success",
  rejected: "bg-destructive",
  uncertain: "bg-warning",
  "not-started": "bg-muted-foreground/40",
};

const LABEL_TONE: Partial<Record<Tone, string>> = {
  held: "text-muted-foreground",
  sending: "text-info",
  confirmed: "text-success",
  rejected: "text-destructive",
  uncertain: "text-warning",
  "not-started": "text-muted-foreground",
};

const SECTION = "flex min-w-0 flex-col gap-1.5";

const revealOnMount = (node: HTMLElement | null) => node?.scrollIntoView({ block: "start" });

function TargetRow({ row }: { row: Row }) {
  const tone: Tone = row.result?.status ?? (row.reason ? "held" : "ready");
  const label = row.result?.label ?? (row.reason ? "Nicht vorgesehen" : "Bereit");
  const message = row.result
    ? row.result.status === "confirmed"
      ? undefined
      : row.result.message
    : row.reason;
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 px-3 py-2 text-xs">
      <span aria-hidden className={cn("mt-1.5 size-2 rounded-full", DOT[tone])} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
          <span className="font-mono font-medium tabular-nums wrap-anywhere">{row.key}</span>
          <span className={cn("ml-auto font-medium", LABEL_TONE[tone])}>{label}</span>
        </div>
        {row.summary && (
          <p className="line-clamp-2 text-muted-foreground wrap-anywhere" title={row.summary}>
            {row.summary}
          </p>
        )}
        {message && (
          <p
            className={cn(
              "wrap-anywhere",
              tone === "rejected"
                ? "text-destructive"
                : tone === "uncertain"
                  ? "text-warning"
                  : "text-muted-foreground",
            )}
          >
            {message}
          </p>
        )}
      </div>
    </li>
  );
}

export function MultiTicketLinks({ state }: { state: MultiTicketLinksState }) {
  const rows = useVisibleItems(state.preview?.rows ?? [], 5);
  const settling = state.pending && !state.checking && !state.writing;
  const shown = state.checking ? null : state.preview;
  const summary = shown ? state.resultSummary : null;
  const footer = !!shown || state.writing || settling || !!state.error;
  const choiceLabel = state.choices.find((choice) => choice.id === state.choiceId)?.label;
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
        className={cn(
          "w-[min(30rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0",
          (state.preview || state.checking) && "min-h-[min(26rem,var(--radix-popover-content-available-height,calc(100dvh-2rem)))]",
        )}
        aria-label="Mehrere Tickets verknüpfen"
      >
        <header className="flex flex-col gap-2 border-b border-foreground/10 px-4 pt-4 pb-3">
          <h2 className="font-medium text-balance">
            Mehrere Tickets verknüpfen
          </h2>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
            <dt className="text-muted-foreground">Quelle</dt>
            <dd className="font-mono font-medium wrap-anywhere">{state.source}</dd>
            <dt className="text-muted-foreground">Konto</dt>
            <dd className="text-muted-foreground wrap-anywhere">{state.account}</dd>
          </dl>
        </header>
        <div
          aria-busy={state.checking}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-3"
        >
          {state.metadataLoading ? (
            <Skeleton className="h-9 w-full rounded-xl" />
          ) : state.metadataError ? (
            <div
              role="alert"
              className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
            >
              <p>{state.metadataError}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={state.retryMetadata}
              >
                Typen neu laden
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {state.noTypes && (
                <p role="status" className="text-xs text-muted-foreground">
                  Keine eindeutig verwendbaren Jira-Beziehungstypen verfügbar.
                  Typen müssen vollständige Richtungsangaben liefern.
                </p>
              )}
              <div className={SECTION}>
                <Label htmlFor="multi-link-type">
                  Quelle steht zu den Zielen in Beziehung…
                </Label>
                <div className="flex min-w-0 items-center gap-1">
                  <Select
                    value={state.choiceId}
                    onValueChange={state.setChoice}
                    disabled={state.pending}
                  >
                    <SelectTrigger
                      id="multi-link-type"
                      title={choiceLabel}
                      className="min-w-0 flex-1 overflow-hidden rounded-xl text-left"
                    >
                      <SelectValue placeholder="Beziehung und Richtung wählen">
                        {choiceLabel && <span className="min-w-0 truncate">{choiceLabel}</span>}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      align="start"
                      className="max-w-(--radix-select-trigger-width) rounded-2xl"
                    >
                      {state.choices.map((choice) => (
                        <SelectItem
                          key={choice.id}
                          value={choice.id}
                          className="rounded-xl py-1.5"
                        >
                          <span className="min-w-0 whitespace-normal wrap-anywhere">
                            {choice.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <IconAction
                    type="button"
                    label="Typen neu laden"
                    tooltip="Typen neu laden"
                    onClick={state.retryMetadata}
                    disabled={state.pending}
                    className="shrink-0 rounded-xl text-muted-foreground"
                  >
                    <RotateCwIcon />
                  </IconAction>
                </div>
              </div>
              <div className={SECTION}>
                <Label htmlFor="multi-link-targets">Explizite Zielkeys</Label>
                <Textarea
                  id="multi-link-targets"
                  value={state.input}
                  onChange={(event) => state.setInput(event.target.value)}
                  disabled={state.pending}
                  placeholder="DEMO-2, DEMO-3"
                  rows={3}
                  className="max-h-40 min-h-20 rounded-xl font-mono text-xs"
                />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Maximal 20 eindeutige Keys, getrennt durch Leerzeichen, Komma,
                  Semikolon oder Zeilenumbruch. Nur diese Ziele werden lesend
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
                className="self-start rounded-xl"
                onClick={state.requestPreview}
                disabled={!state.canPreview}
              >
                {state.checking ? "Wird lesend geprüft…" : "Vorschau prüfen"}
              </Button>
            </div>
          )}
          <AnimatePresence initial={false} mode="wait">
            {state.checking ? (
              <Fade key="checking">
                <div aria-hidden className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              </Fade>
            ) : state.preview ? (
              <Fade key="preview">
                <section
                  ref={revealOnMount}
                  aria-label="Vorschau"
                  className="flex min-w-0 flex-col gap-2.5 border-t border-foreground/10 pt-3"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-medium wrap-anywhere">
                      {state.preview.directionLabel}
                    </p>
                    {!state.resultSummary && !state.writing && (
                      <span className="shrink-0 rounded-xl border px-2 py-0.5 text-[11px] text-muted-foreground">
                        Nur gelesen
                      </span>
                    )}
                  </div>
                  <p className="-mt-1.5 line-clamp-2 text-xs text-muted-foreground wrap-anywhere">
                    {state.preview.source.summary}
                  </p>
                  <p className="text-xs tabular-nums">
                    {state.preview.ready} von {state.preview.total} Zielen zur
                    Abgabe geprüft
                  </p>
                  {state.preview.unreadable > 0 && (
                    <p className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
                      {state.preview.unreadable} vorhandene Beziehungen sind
                      nicht vollständig lesbar. Die Doppelprüfung kann
                      unvollständig sein.
                    </p>
                  )}
                  <ul
                    aria-label="Geprüfte Zielmenge"
                    className="flex flex-col divide-y overflow-hidden rounded-xl border"
                  >
                    {rows.visible.map((row) => (
                      <TargetRow key={row.key} row={row} />
                    ))}
                  </ul>
                  {rows.canExpand && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-8 self-start rounded-xl text-xs"
                      aria-expanded={rows.expanded}
                      onClick={rows.toggle}
                    >
                      {rows.expanded
                        ? "Weniger anzeigen"
                        : `Alle Ziele anzeigen (${state.preview.total})`}
                    </Button>
                  )}
                </section>
              </Fade>
            ) : null}
          </AnimatePresence>
        </div>
        {footer && (
          <footer className="flex flex-col gap-2 border-t border-foreground/10 px-4 py-3">
            {summary && (
              <p role="status" className="text-xs font-medium tabular-nums wrap-anywhere">
                {summary}
              </p>
            )}
            {settling && (
              <p role="status" className="text-xs text-muted-foreground">
                Vorheriger Lauf wird beendet.
              </p>
            )}
            {state.error && (
              <p
                role="alert"
                className="max-h-20 overflow-y-auto text-xs leading-relaxed text-destructive"
              >
                {state.error}
              </p>
            )}
            {state.writing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={state.stop}
                >
                  Weitere Abgaben stoppen
                </Button>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Bereits abgegebene Anfragen laufen weiter und lassen sich
                  nicht zurückrufen.
                </p>
              </>
            ) : shown ? (
              <>
                <Button
                  type="button"
                  className="w-full rounded-xl aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                  onClick={state.canConfirm ? state.confirm : undefined}
                  aria-disabled={!state.canConfirm}
                >
                  Geprüfte Verknüpfungen bestätigen
                </Button>
                {!summary && (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Einzellinks, höchstens zwei gleichzeitig · keine Transaktion,
                    kein Rollback, keine automatische Wiederholung · unklarer
                    Ausgang bleibt bis zur Prüfung in Jira unklar.
                  </p>
                )}
              </>
            ) : null}
          </footer>
        )}
      </PopoverContent>
    </Popover>
  );
}
