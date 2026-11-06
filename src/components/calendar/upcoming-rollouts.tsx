import { motion, useReducedMotion } from "motion/react";
import { RocketIcon } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Skeleton } from "@/components/ui/skeleton";
import type { Rollout } from "@/lib/calendar/model";
import { shortDate, timeRange } from "@/lib/calendar/presentation";
import { SPRING_PRESS } from "@/lib/ease";

type UpcomingRolloutsProps = {
  rollouts: readonly Rollout[];
  pending: boolean;
  onSelect: (rollout: Rollout) => void;
};

export function UpcomingRollouts({ rollouts, pending, onSelect }: UpcomingRolloutsProps) {
  const reduce = useReducedMotion();
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Nächste Rollouts">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <RocketIcon className="size-4 text-muted-foreground" />
        Nächste Rollouts
      </h2>
      {pending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 rounded-md" />
          <Skeleton className="h-9 rounded-md" />
          <Skeleton className="h-9 rounded-md" />
        </div>
      ) : rollouts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine anstehenden Rollouts.</p>
      ) : (
        <Stagger className="flex flex-col gap-1">
          {rollouts.map((rollout) => (
            <StaggerItem key={rollout.id}>
              <motion.button
                type="button"
                onClick={() => onSelect(rollout)}
                whileTap={reduce ? undefined : { scale: 0.98 }}
                transition={SPRING_PRESS}
                className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">{shortDate(rollout.start)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{rollout.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {timeRange(rollout)}
                    {rollout.issues.length > 0 && ` · ${rollout.issues.map((issue) => issue.key).join(", ")}`}
                  </span>
                </span>
              </motion.button>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </section>
  );
}
