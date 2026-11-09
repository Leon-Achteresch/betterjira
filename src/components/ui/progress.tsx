"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { FADE_IN } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { Progress as ProgressPrimitive } from "radix-ui";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const reduce = useReducedMotion();
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator asChild>
        <motion.div
          data-slot="progress-indicator"
          initial={false}
          animate={{ scaleX: Math.min(100, Math.max(0, value ?? 0)) / 100 }}
          transition={reduce ? { duration: 0 } : FADE_IN}
          className="size-full origin-left rounded-full bg-primary"
        />
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
