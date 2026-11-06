import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDownIcon, InfoIcon } from "lucide-react";
import { JiraStatusBadge } from "@/components/jira-status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSubtaskOverview } from "@/hooks/jira/use-subtask-overview";
import { useVisibleItems } from "@/hooks/use-visible-items";
import { EASE_OUT } from "@/lib/ease";
import { subtaskState } from "@/lib/jira/subtask-overview";
import { cn } from "@/lib/utils";

const LIST_LIMIT = 7;

type Subtask = {
  id: string;
  key: string;
  fields: { summary: string; status: { name: string; statusCategory: { key: string; colorName: string } } };
};

const unknownLabel = (count: number) => (count === 1 ? "1 Status unbekannt" : `${count} Status unbekannt`);

function SubtaskRow({ subtask }: { subtask: Subtask }) {
  const unknown = subtaskState(subtask) === "unknown";
  return (
    <Link
      to="/issue/$key"
      params={{ key: subtask.key }}
      data-row-link
      className="grid min-h-9 grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className="truncate font-mono text-xs text-muted-foreground">{subtask.key}</span>
      <span className="truncate">{subtask.fields.summary}</span>
      <span className="flex items-center gap-1.5">
        <JiraStatusBadge status={subtask.fields.status} />
        {unknown && <span className="sr-only">Statuskategorie unbekannt</span>}
      </span>
    </Link>
  );
}

export function IssueSubtasks({ subtasks }: { subtasks: readonly Subtask[] }) {
  const reduce = useReducedMotion();
  const { filter, setFilter, overview } = useSubtaskOverview(subtasks);
  const { visible, expanded, canExpand, toggle } = useVisibleItems(overview.visible, LIST_LIMIT);
  const hidden = overview.visible.length - LIST_LIMIT;
  const allDone = overview.total > 0 && overview.done === overview.total;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-40 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <Progress
            value={overview.total ? (overview.done / overview.total) * 100 : 0}
            aria-label="Fortschritt der Unteraufgaben"
            className="h-1 w-16 max-w-32 flex-1"
          />
          <span aria-hidden className="whitespace-nowrap">
            {overview.done}/{overview.total} erledigt
          </span>
          <span className="sr-only">{`${overview.done} von ${overview.total} geladenen Unteraufgaben erledigt`}</span>
          {overview.unknown > 0 && <span className="whitespace-nowrap">{unknownLabel(overview.unknown)}</span>}
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Unteraufgaben filtern"
          value={filter}
          onValueChange={(value) => (value === "all" || value === "open") && setFilter(value)}
        >
          <ToggleGroupItem value="all" className="h-8 px-3 tabular-nums">
            Alle <span className="text-muted-foreground">{overview.total}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="open" className="h-8 px-3 tabular-nums">
            Offen <span className="text-muted-foreground">{overview.open}</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {overview.visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {allDone ? "Alle Unteraufgaben sind erledigt." : "Keine offenen Unteraufgaben."}
        </p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          <AnimatePresence initial={false}>
            {visible.map((subtask) => (
              <motion.li
                key={subtask.id}
                initial={{ opacity: 0, y: reduce ? 0 : -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
              >
                <SubtaskRow subtask={subtask} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {canExpand && (
        <Button variant="ghost" onClick={toggle} aria-expanded={expanded} className="self-start rounded-xl text-muted-foreground">
          <ChevronDownIcon
            aria-hidden
            className={cn("transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")}
          />
          {expanded ? "Weniger anzeigen" : `${hidden} weitere anzeigen`}
        </Button>
      )}

      {overview.hiddenUnknown > 0 && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          {overview.hiddenUnknown === 1
            ? "Eine Unteraufgabe mit unbekannter Statuskategorie ist hier nicht enthalten."
            : `${overview.hiddenUnknown} Unteraufgaben mit unbekannter Statuskategorie sind hier nicht enthalten.`}
        </p>
      )}
    </div>
  );
}
