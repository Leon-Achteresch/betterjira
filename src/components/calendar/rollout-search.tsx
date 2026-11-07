import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SearchField } from "@/components/motion/search-field";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Rollout } from "@/lib/calendar/model";
import { resultDate, type RolloutSearchStatus } from "@/lib/calendar/rollout-search";
import { EASE_OUT, SPRING_PRESS } from "@/lib/ease";

type RolloutSearchProps = {
  value: string;
  onChange: (value: string) => void;
  status: RolloutSearchStatus;
  results: readonly Rollout[];
  total: number;
  canExpand: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSelect: (rollout: Rollout) => void;
};

const LABEL = "Geladene Rollouts durchsuchen";

export function RolloutSearch({ value, onChange, status, results, total, canExpand, expanded, onToggleExpanded, onSelect }: RolloutSearchProps) {
  const reduce = useReducedMotion();
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label={LABEL}>
      <SearchField value={value} onChange={onChange} label={LABEL} placeholder={LABEL} />
      <AnimatePresence initial={false}>
        {status !== "idle" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: reduce ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="flex flex-col gap-2"
          >
            {status === "pending" ? (
              <div role="status" aria-label="Rollouts werden geladen" className="flex flex-col gap-2">
                <Skeleton className="h-11 rounded-xl" />
                <Skeleton className="h-11 rounded-xl" />
              </div>
            ) : status === "error" ? (
              <p role="status" className="text-sm text-muted-foreground">
                Die Rollouts sind gerade nicht geladen, deshalb kann nicht gesucht werden.
              </p>
            ) : (
              <>
                <p role="status" className="text-xs text-muted-foreground tabular-nums">
                  {total === 0
                    ? "Keine Treffer in den geladenen Rollouts. Outlook und Jira werden nicht durchsucht."
                    : `${total} Treffer in den geladenen Rollouts`}
                </p>
                {total > 0 && (
                  <Stagger role="list" aria-label="Treffer in geladenen Rollouts" className="flex flex-col gap-1">
                    {results.map((rollout) => (
                      <StaggerItem key={rollout.id} role="listitem">
                        <motion.button
                          type="button"
                          onClick={() => onSelect(rollout)}
                          whileTap={reduce ? undefined : { scale: 0.98 }}
                          transition={SPRING_PRESS}
                          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="w-28 shrink-0 text-xs text-muted-foreground tabular-nums">{resultDate(rollout.start)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{rollout.title}</span>
                            {rollout.issues.length > 0 && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {rollout.issues.map((issue) => issue.key).join(", ")}
                              </span>
                            )}
                          </span>
                        </motion.button>
                      </StaggerItem>
                    ))}
                  </Stagger>
                )}
                {canExpand && (
                  <Button size="sm" variant="ghost" className="self-start tabular-nums" onClick={onToggleExpanded}>
                    {expanded ? "Weniger anzeigen" : `Weitere anzeigen (${total - results.length})`}
                  </Button>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
