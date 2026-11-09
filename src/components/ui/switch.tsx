"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { useControllableState } from "@/components/motion/use-controllable-state";
import { useControlMotion } from "@/components/motion/use-control-motion";
import { SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { Switch as SwitchPrimitive } from "radix-ui";

function Switch({
  className,
  size = "default",
  ref,
  checked,
  defaultChecked = false,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  const reduce = useReducedMotion();
  const motionRef = useControlMotion({ ref, disabled: props.disabled });
  const [active, setActive] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  });
  return (
    <SwitchPrimitive.Root
      ref={motionRef}
      checked={active}
      onCheckedChange={setActive}
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors outline-none group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb asChild>
        <motion.span
          data-slot="switch-thumb"
          initial={false}
          animate={{ x: active ? (size === "sm" ? 10 : 14) : 0 }}
          transition={reduce ? { duration: 0 } : SPRING_PRESS}
          className="pointer-events-none block rounded-full bg-background shadow-xs ring-0 group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 dark:bg-foreground"
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
