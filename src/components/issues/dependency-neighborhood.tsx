import { useId } from "react";
import { NetworkIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { DependencyNeighborhoodState } from "@/hooks/jira/use-dependency-neighborhood";
import { useVisibleItems } from "@/hooks/use-visible-items";
import { DEPENDENCY_LIMITS } from "@/lib/jira/dependency-neighborhood";
import type { IssueLinkDirection } from "@/lib/jira/issue-links";
import { cn } from "@/lib/utils";

type Result = NonNullable<DependencyNeighborhoodState["result"]>;
const directionLabel = (direction: IssueLinkDirection) => direction === "outward" ? "ausgehend" : "eingehend";
const nodeMessage = {
  read: "",
  "read-limit": "Nicht weiter gelesen",
  "depth-limit": "Tiefengrenze erreicht",
  forbidden: "Kein Lesezugriff",
  unavailable: "Ticket konnte nicht gelesen werden",
  "missing-links": "Ticket oder Linkdaten nicht bestätigt",
};

function DependencyResult({ result }: { result: Result }) {
  const relevant = result.nodes.filter((node) => node.depth > 0 || node.via.length > 0 || node.state !== "read");
  const rows = useVisibleItems(relevant, 5);
  const limited = result.limits.nodes || result.limits.edges || result.limits.linksPerRead;
  const partial = limited || result.unreadable > 0 || relevant.some((node) => node.state !== "read");
  return (
    <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-3">
      <p className="text-xs font-medium wrap-anywhere">
        {result.choice.label} ({directionLabel(result.choice.direction)})
      </p>
      <p role="status" className="text-xs tabular-nums">
        {result.nodes.length - 1} verbundene Tickets · {result.edges} Beziehungen · {result.reads} von {DEPENDENCY_LIMITS.reads} Abrufen
      </p>
      {partial && (
        <p className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
          Teilabdeckung. {result.rateLimited && "Jira drosselt weitere Abrufe. "}
          {result.unreadable > 0 && `${result.unreadable} Linkeinträge waren nicht eindeutig lesbar. `}
          {result.limits.nodes && "Ticketlimit erreicht. "}
          {result.limits.edges && "Beziehungslimit erreicht. "}
          {result.limits.linksPerRead && "Limit für Linkeinträge pro Antwort erreicht. "}
          {result.reads === DEPENDENCY_LIMITS.reads && relevant.some(({ state }) => state === "read-limit") && "Abruflimit erreicht."}
        </p>
      )}
      {relevant.length ? (
        <ul aria-label="Tickets im Umfeld" className="divide-y rounded-xl border">
          {rows.visible.map((node) => (
            <li key={node.key} data-ticket-key={node.key} className="flex min-w-0 flex-col gap-1 px-3 py-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-xs font-medium wrap-anywhere">{node.key}</span>
                <span className="text-xs text-muted-foreground">{node.depth === 0 ? "Ausgangsticket" : `Ebene ${node.depth}`}</span>
              </div>
              {node.via.length > 0 && (
                <p className="text-xs text-muted-foreground wrap-anywhere">
                  {node.via.map((via) => result.choice.direction === "outward" ? `${via} → ${node.key}` : `${node.key} → ${via}`).join(" · ")}
                </p>
              )}
              {nodeMessage[node.state] && <p className="text-xs text-muted-foreground">{nodeMessage[node.state]}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">In den lesbaren Linkdaten wurden keine passenden Beziehungen gefunden.</p>
      )}
      {rows.canExpand && (
        <Button type="button" variant="ghost" size="sm" aria-expanded={rows.expanded} onClick={rows.toggle} className="min-h-8 self-start rounded-xl">
          {rows.expanded ? "Weniger Tickets anzeigen" : "Alle Tickets anzeigen"}
        </Button>
      )}
    </div>
  );
}

export function DependencyNeighborhood({ state }: { state: DependencyNeighborhoodState }) {
  const id = useId();
  return (
    <>
      <Popover open={state.open} onOpenChange={state.setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" className={cn(
            "mt-2 min-h-8 self-start rounded-xl text-xs",
            state.open && "sticky bottom-4 z-10",
          )}>
            <NetworkIcon className="size-3.5" />
            Abhängigkeiten ansehen
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" collisionPadding={16} aria-label="Abhängigkeiten ansehen" className="w-[min(28rem,calc(100vw-2rem))] p-3">
          <header className="flex flex-col gap-1">
            <h2 className="font-medium text-balance">Abhängigkeiten ansehen</h2>
            <p className="text-xs text-muted-foreground wrap-anywhere">Ausgangsticket <span className="font-mono text-foreground">{state.source}</span></p>
            <p className="text-xs text-muted-foreground">
              Bis zu {DEPENDENCY_LIMITS.depth} Ebenen, {DEPENDENCY_LIMITS.reads} Abrufe und {DEPENDENCY_LIMITS.nodes} Tickets inklusive Ausgangsticket. Nur sichtbare Jira-Links.
            </p>
          </header>
          {!state.available ? (
            <p role="alert" className="text-xs text-destructive">Jira-Konto oder Instanz konnte nicht bestätigt werden.</p>
          ) : state.metadataError ? (
            <>
              <p role="alert" className="text-xs text-destructive">Beziehungstypen konnten nicht geladen werden.</p>
              <Button type="button" size="sm" variant="outline" onClick={state.retryMetadata} className="min-h-8 self-start rounded-xl">Erneut versuchen</Button>
            </>
          ) : state.metadataLoading ? (
            <Skeleton aria-label="Beziehungstypen werden geladen" className="h-8 w-full rounded-xl" />
          ) : state.choices.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine eindeutig gerichteten Beziehungstypen verfügbar.</p>
          ) : (
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor={id}>Beziehung und Richtung</Label>
              <Select value={state.selected} onValueChange={state.select}>
                <SelectTrigger id={id} className="w-full min-w-0 rounded-xl">
                  <SelectValue placeholder="Beziehung wählen" />
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="max-w-(--radix-select-trigger-width) rounded-2xl">
                  {state.choices.map((choice) => (
                    <SelectItem key={choice.id} value={choice.id} className="rounded-xl">
                      <span className="whitespace-normal wrap-anywhere">{choice.type.name} · {choice.label} ({directionLabel(choice.direction)})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" disabled={!state.canLoad} onClick={state.load} className="min-h-8 self-start rounded-xl">
                Abhängigkeiten laden
              </Button>
            </div>
          )}
          <AnimatePresence initial={false} mode="wait">
            {state.loading ? (
              <Fade key="loading">
                <div aria-busy="true" aria-label="Abhängigkeiten werden gelesen" className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-3/5 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </div>
              </Fade>
            ) : state.error ? (
              <Fade key="error"><p role="alert" className="text-xs text-destructive">Das Umfeld konnte im aktuellen Kontext nicht gelesen werden. Wähle die Beziehung erneut.</p></Fade>
            ) : state.result ? (
              <Fade key={state.result.id}><DependencyResult result={state.result} /></Fade>
            ) : null}
          </AnimatePresence>
        </PopoverContent>
      </Popover>
      {state.changed && <p role="status" className="text-xs text-muted-foreground">Ticket oder Jira-Kontext gewechselt. Wähle die Beziehung erneut.</p>}
    </>
  );
}
