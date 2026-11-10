import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleAlertIcon, RefreshCwIcon, WifiOffIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { freshnessMessage, standLabel, type FreshnessTone } from "@/lib/dashboard-freshness";
import { EASE_OUT, SPRING_LAYOUT, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

const MotionButton = motion.create(Button);

export function RefreshStatus({
  tone,
  updatedAt,
  failed,
  now,
  onRefresh,
}: {
  tone: FreshnessTone;
  updatedAt: number;
  failed: readonly string[];
  now: Date;
  onRefresh: () => void;
}) {
  const reduce = useReducedMotion();
  const refreshing = tone === "refreshing";
  const problem = tone === "partial" || tone === "failed";
  const warning = problem || tone === "offline";
  const label = problem ? "Erneut versuchen" : "Übersicht aktualisieren";
  return (
    <div className="flex min-h-8 items-center gap-1.5 text-xs text-muted-foreground" data-testid="dashboard-freshness">
      <div role="status" aria-live="polite" className="min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={tone}
            initial={{ opacity: 0, y: reduce ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : -4, transition: { duration: 0.12, ease: EASE_OUT } }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className={cn("block text-pretty tabular-nums", warning && "text-warning")}
          >
            {tone === "offline" ? (
              <WifiOffIcon className="mr-1.5 inline size-3.5 -translate-y-px" />
            ) : problem ? (
              <CircleAlertIcon className="mr-1.5 inline size-3.5 -translate-y-px" />
            ) : null}
            {tone !== "fresh" && `${freshnessMessage(tone, failed)} · `}
            <span className={cn("whitespace-nowrap", warning && "text-muted-foreground")}>
              {standLabel(updatedAt, now)}
            </span>
          </motion.span>
        </AnimatePresence>
      </div>
      <Tooltip content={refreshing ? "Wird bereits aktualisiert" : label}>
        <MotionButton
          layout={!reduce}
          transition={SPRING_LAYOUT}
          variant={problem ? "outline" : "ghost"}
          size={problem ? "default" : "icon"}
          aria-label={label}
          aria-disabled={refreshing || undefined}
          onClick={onRefresh}
          whileTap={reduce || refreshing ? undefined : { scale: 0.96 }}
          className={cn("text-muted-foreground", refreshing && "cursor-progress")}
        >
          <motion.span layout={reduce ? false : "position"} transition={SPRING_PRESS} className="inline-flex">
            <RefreshCwIcon className={cn(refreshing && "animate-spin motion-reduce:animate-none")} />
          </motion.span>
          {problem && <span className="text-foreground">Erneut versuchen</span>}
        </MotionButton>
      </Tooltip>
    </div>
  );
}
