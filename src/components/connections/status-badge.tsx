import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cva } from "class-variance-authority";
import type { StatusLabel } from "@/lib/connections/status";
import { SPRING_SWAP } from "@/lib/ease";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva("inline-flex h-6 shrink-0 items-center rounded-xl px-2.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-muted text-muted-foreground",
      success: "bg-success/12 text-success",
      warning: "bg-warning/12 text-warning",
      destructive: "bg-destructive/10 text-destructive",
    },
  },
});

export function StatusBadge({ status, className }: { status: StatusLabel; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={status.label}
        initial={{ opacity: 0, y: reduce ? 0 : 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
        transition={reduce ? { duration: 0.12 } : SPRING_SWAP}
        className={cn(statusBadgeVariants({ tone: status.tone }), className)}
      >
        {status.label}
      </motion.span>
    </AnimatePresence>
  );
}
