import { format, isValid, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarDaysIcon } from "lucide-react";
import { useState } from "react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DateField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const date = parseISO(value);
  const selected = isValid(date) ? date : undefined;

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Input id={id} type="date" className="min-w-0 flex-1" value={value} onChange={(event) => onChange(event.target.value)} />
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip content="Kalender öffnen">
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Kalender öffnen">
              <CalendarDaysIcon />
            </Button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent align="end" aria-label="Datum auswählen" className="w-auto p-1.5">
          <Calendar
            mode="single"
            locale={de}
            weekStartsOn={1}
            autoFocus
            defaultMonth={selected}
            selected={selected}
            onSelect={(next) => {
              if (!next) return;
              onChange(format(next, "yyyy-MM-dd"));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
