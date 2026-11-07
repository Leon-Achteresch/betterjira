import type { ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SelectOption } from "@/types/select-option";

type OptionSelectProps = {
  label: string;
  value: string;
  options: readonly SelectOption[];
  icon?: ReactNode;
  className?: string;
  onValueChange: (value: string) => void;
};

export function OptionSelect({ label, value, options, icon, className, onValueChange }: OptionSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={label} className={cn("h-8 max-w-64 min-w-40 rounded-xl", icon && "*:data-[slot=select-value]:flex-1", className)}>
        {icon}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
