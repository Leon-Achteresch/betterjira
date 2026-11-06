import type { Ref } from "react";
import { motion, useReducedMotion } from "motion/react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { SPRING_LAYOUT, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

export type TextSizeOption<T extends string> = {
  value: T;
  label: string;
  scale: number;
};

export function TextSizePicker<T extends string>({
  label,
  value,
  options,
  onChange,
  ref,
}: {
  ref?: Ref<HTMLDivElement>;
  label: string;
  value: T;
  options: TextSizeOption<T>[];
  onChange: (value: T) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        const option = options.find((candidate) => candidate.value === next);
        if (option) onChange(option.value);
      }}
      className="grid w-full grid-cols-3 gap-3"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <RadioGroupPrimitive.Item key={option.value} value={option.value} asChild>
            <motion.button
              type="button"
              whileTap={reduce ? undefined : { scale: 0.98 }}
              transition={SPRING_PRESS}
              className="group relative flex min-h-24 flex-col items-start justify-between gap-3 rounded-xl bg-card p-3 text-left shadow-xs ring-1 ring-border outline-none transition-shadow hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className={cn(
                  "font-medium leading-none tracking-tight transition-colors",
                  selected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                )}
                style={{ fontSize: `${option.scale * 1.375}rem` }}
              >
                Aa
              </span>
              <span
                className={cn(
                  "text-sm transition-colors",
                  selected ? "font-medium text-foreground" : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                {option.label}
              </span>
              {selected && (
                <motion.span
                  layoutId={`${label}-selected`}
                  transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                  className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary ring-inset"
                />
              )}
            </motion.button>
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
