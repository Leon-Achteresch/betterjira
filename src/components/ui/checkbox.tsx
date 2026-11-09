import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useControllableState } from "@/components/motion/use-controllable-state";
import { useControlMotion } from "@/components/motion/use-control-motion";
import { FADE_OUT, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { CheckIcon, MinusIcon } from "lucide-react";

function Checkbox({
  className,
  ref,
  checked,
  defaultChecked = false,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const reduce = useReducedMotion();
  const motionRef = useControlMotion({ ref, disabled: props.disabled });
  const [active, setActive] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  });
  return (
    <CheckboxPrimitive.Root
      ref={motionRef}
      checked={active}
      onCheckedChange={setActive}
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors outline-none group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary",
        className,
      )}
      {...props}
    >
      <AnimatePresence initial={false}>
        {active !== false && (
          <CheckboxPrimitive.Indicator forceMount asChild>
            <motion.span
              key={String(active)}
              data-slot="checkbox-indicator"
              initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: FADE_OUT }}
              transition={SPRING_PRESS}
              className="grid place-content-center text-current [&>svg]:size-3.5"
            >
              {active === "indeterminate" ? <MinusIcon /> : <CheckIcon />}
            </motion.span>
          </CheckboxPrimitive.Indicator>
        )}
      </AnimatePresence>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
