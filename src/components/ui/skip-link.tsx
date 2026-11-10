import type { ComponentProps } from "react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export function SkipLink({ className, ...props }: ComponentProps<typeof motion.a>) {
  const reduce = useReducedMotion();
  return (
    <motion.a
      initial={{ opacity: 0, y: reduce ? 0 : -6 }}
      whileFocus={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: EASE_OUT }}
      className={cn(
        "pointer-events-none fixed top-2 left-1/2 z-[100] inline-flex h-9 -translate-x-1/2 items-center rounded-xl border border-border px-4 text-sm font-medium whitespace-nowrap text-foreground shadow-lg outline-none glass focus:pointer-events-auto focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}
