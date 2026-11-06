import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Tooltip } from "@/components/motion/tooltip";
import { useThemeCycle } from "@/hooks/use-theme";
import { SPRING_PRESS, SPRING_SWAP } from "@/lib/ease";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, label, Icon, cycle } = useThemeCycle();
  const reduceMotion = useReducedMotion();
  const offset = reduceMotion ? 0 : 6;

  return (
    <Tooltip content={label} side="bottom">
      <motion.button
        type="button"
        aria-label={label}
        onClick={cycle}
        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
        transition={SPRING_PRESS}
        className={cn(
          "relative inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          className,
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={theme}
            initial={{ opacity: 0, y: offset }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -offset, transition: { duration: 0.12 } }}
            transition={SPRING_SWAP}
            className="inline-flex"
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </Tooltip>
  );
}
