import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { SPRING_LAYOUT, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

type Scheme = "light" | "dark";

export type ThemeOption<T extends string> = {
  value: T;
  label: string;
  icon: LucideIcon;
  schemes: Scheme[];
};

function SchemePreview({ scheme, className }: { scheme: Scheme; className?: string }) {
  return (
    <span aria-hidden className={cn(scheme, "absolute inset-0 flex bg-background text-foreground", className)}>
      <span className="flex w-1/4 flex-col gap-1.5 bg-sidebar px-2 py-3">
        <span className="h-1.5 w-3/4 rounded-full bg-primary" />
        <span className="h-1 w-full rounded-full bg-muted-foreground/30" />
        <span className="h-1 w-2/3 rounded-full bg-muted-foreground/30" />
        <span className="h-1 w-4/5 rounded-full bg-muted-foreground/30" />
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="h-2 w-1/2 rounded-full bg-foreground/80" />
        <span className="h-1 w-3/4 rounded-full bg-muted-foreground/40" />
        <span className="mt-auto grid grid-cols-3 gap-1.5">
          <span className="h-6 rounded-md bg-card shadow-xs ring-1 ring-border" />
          <span className="h-6 rounded-md bg-card shadow-xs ring-1 ring-border" />
          <span className="h-6 rounded-md bg-muted" />
        </span>
      </span>
    </span>
  );
}

export function ThemePicker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ThemeOption<T>[];
  onChange: (value: T) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <RadioGroupPrimitive.Root
      aria-label={label}
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className="grid w-full max-w-2xl grid-cols-3 gap-4"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <RadioGroupPrimitive.Item key={option.value} value={option.value} asChild>
            <motion.button
              type="button"
              whileHover={reduce ? undefined : { y: -2 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              transition={SPRING_PRESS}
              className="group flex flex-col gap-2.5 text-left outline-none"
            >
              <span className="relative block aspect-[16/10] overflow-hidden rounded-xl shadow-xs ring-1 ring-border transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
                {option.schemes.map((scheme, index) => (
                  <SchemePreview
                    key={scheme}
                    scheme={scheme}
                    className={cn(index > 0 && "[clip-path:polygon(100%_0,100%_100%,0_100%)]")}
                  />
                ))}
                {selected && (
                  <motion.span
                    layoutId={`${label}-selected`}
                    transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                    className="absolute inset-0 rounded-xl ring-2 ring-primary ring-inset"
                  />
                )}
              </span>
              <span
                className={cn(
                  "flex items-center gap-2 px-0.5 text-sm transition-colors",
                  selected ? "font-medium text-foreground" : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                <option.icon className="size-4" strokeWidth={1.75} />
                {option.label}
              </span>
            </motion.button>
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
