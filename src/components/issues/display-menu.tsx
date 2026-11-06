import { motion, useReducedMotion } from "motion/react";
import { CheckIcon, SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

type DisplayMenuProps<T extends string> = {
  title: string;
  properties: Record<T, string>;
  hidden: readonly T[];
  changed: boolean;
  onToggle: (property: T) => void;
  onReset: () => void;
};

export function DisplayMenu<T extends string>({ title, properties, hidden, changed, onToggle, onReset }: DisplayMenuProps<T>) {
  const reduce = useReducedMotion();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <SlidersHorizontalIcon />
          Anzeige
          {changed && <span aria-label="Angepasst" className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="px-1 text-xs font-medium text-muted-foreground">{title}</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(properties) as [T, string][]).map(([property, label]) => {
            const shown = !hidden.includes(property);
            return (
              <motion.button
                key={property}
                type="button"
                aria-pressed={shown}
                onClick={() => onToggle(property)}
                whileTap={reduce ? undefined : { scale: 0.96 }}
                transition={SPRING_PRESS}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  shown ? "bg-primary/12 text-foreground ring-primary/30" : "text-muted-foreground ring-foreground/10 hover:bg-muted",
                )}
              >
                {shown && <CheckIcon className="size-3" />}
                {label}
              </motion.button>
            );
          })}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="xs" onClick={onReset} disabled={!changed}>
            Zurücksetzen
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
