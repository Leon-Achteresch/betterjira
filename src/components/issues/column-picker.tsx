import { CheckIcon, Columns3Icon, GripVerticalIcon, XIcon } from "lucide-react";
import { Reorder, useDragControls, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export type PickerColumn = { id: string; label: string };
export type PickerField = { id: string; name: string; custom?: boolean };

function ActiveColumn({ column, onRemove }: { column: PickerColumn; onRemove: () => void }) {
  const controls = useDragControls();
  const reduce = useReducedMotion();
  return (
    <Reorder.Item
      value={column.id}
      dragListener={false}
      dragControls={controls}
      transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
      whileDrag={{ scale: 1.02, boxShadow: "0 6px 16px -6px rgb(0 0 0 / 0.25)" }}
      className="flex items-center gap-1 rounded-md bg-popover px-1 py-0.5 text-sm"
    >
      <span
        onPointerDown={(event) => controls.start(event)}
        className="flex cursor-grab touch-none items-center text-muted-foreground active:cursor-grabbing"
        aria-hidden
      >
        <GripVerticalIcon className="size-3.5" />
      </span>
      <span className="flex-1 truncate">{column.label}</span>
      <Button variant="ghost" size="icon-xs" onClick={onRemove} aria-label={`${column.label} ausblenden`}>
        <XIcon />
      </Button>
    </Reorder.Item>
  );
}

export function ColumnPicker({
  columns,
  fields,
  onToggle,
  onReorder,
}: {
  columns: PickerColumn[];
  fields: PickerField[];
  onToggle: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const active = new Set(columns.map((column) => column.id));
  const groups = [
    { label: "Standardfelder", fields: [{ id: "key", name: "Schlüssel" }, ...fields.filter((field) => !field.custom)] },
    { label: "Eigene Felder", fields: fields.filter((field) => field.custom) },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3Icon />
          Spalten
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-2 p-2">
        <p className="px-1 text-xs font-medium text-muted-foreground">Angezeigt · zum Sortieren ziehen</p>
        <Reorder.Group axis="y" values={columns.map((column) => column.id)} onReorder={onReorder} className="flex max-h-56 flex-col overflow-y-auto">
          {columns.map((column) => (
            <ActiveColumn key={column.id} column={column} onRemove={() => onToggle(column.id)} />
          ))}
        </Reorder.Group>
        <Separator />
        <Command className="bg-transparent">
          <CommandInput placeholder="Feld hinzufügen…" />
          <CommandList className="max-h-64">
            <CommandEmpty>Kein Feld gefunden</CommandEmpty>
            {groups.map(
              (group) =>
                group.fields.length > 0 && (
                  <CommandGroup key={group.label} heading={group.label}>
                    {group.fields.map((field) => (
                      <CommandItem key={field.id} value={`${field.name} ${field.id}`} onSelect={() => onToggle(field.id)}>
                        <CheckIcon className={cn("transition-opacity", active.has(field.id) ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{field.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ),
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
