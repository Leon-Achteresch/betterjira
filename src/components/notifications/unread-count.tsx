import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/ease";

export function UnreadCount({ value }: { value: number }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {value > 0 && (
        <motion.span
          initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
          transition={{ duration: 0.16, ease: EASE_OUT }}
          className="rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums leading-4 text-primary-foreground"
        >
          {value > 99 ? "99+" : value}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
