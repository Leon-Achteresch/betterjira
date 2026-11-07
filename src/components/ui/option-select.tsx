import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { OptionSelectProps } from "@/types/select-option";

export function OptionSelect({ label, value, options, icon, className, onValueChange }: OptionSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={label} className={cn("h-8 max-w-64 min-w-40 rounded-xl", icon && "*:data-[slot=select-value]:flex-1", className)}>
        {icon}
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" className="motion-reduce:animate-none!">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="min-h-8">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
