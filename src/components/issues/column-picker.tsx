import type { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, Columns3Icon, GripVerticalIcon, XIcon } from "lucide-react";
import { Reorder, motion, useDragControls, useReducedMotion } from "motion/react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useColumnReorder } from "@/hooks/use-column-reorder";
import { SPRING_LAYOUT, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

export type PickerColumn = { id: string; label: string };
export type PickerField = { id: string; name: string; custom?: boolean };

const MotionButton = motion.create(Button);

function MoveButton({
  label,
  hint,
  disabled,
  onMove,
  children,
}: {
  label: string;
  hint: string;
  disabled: boolean;
  onMove: (target: HTMLElement) => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <Tooltip content={hint} side="top">
      <MotionButton
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (!disabled) onMove(event.currentTarget);
        }}
        whileTap={reduce || disabled ? undefined : { scale: 0.96 }}
        transition={SPRING_PRESS}
        className="text-muted-foreground aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent [&_svg]:size-3.5"
      >
        {children}
      </MotionButton>
    </Tooltip>
  );
}

function ActiveColumn({
  column,
  canMoveUp,
  canMoveDown,
  onMove,
  onRemove,
}: {
  column: PickerColumn;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (offset: number, target: HTMLElement) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  const reduce = useReducedMotion();
  return (
    <Reorder.Item
      value={column.id}
      dragListener={false}
      dragControls={controls}
      transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
      whileDrag={{ scale: 1.02, boxShadow: "0 6px 16px -6px rgb(0 0 0 / 0.25)" }}
      className="group/column flex items-center gap-1 rounded-md bg-popover px-1 text-sm"
    >
      <span
        onPointerDown={(event) => controls.start(event)}
        className="flex cursor-grab touch-none items-center text-muted-foreground active:cursor-grabbing"
        aria-hidden
      >
        <GripVerticalIcon className="size-3.5" />
      </span>
      <span className="flex-1 truncate">{column.label}</span>
      <span className="flex items-center opacity-0 transition-opacity duration-150 group-focus-within/column:opacity-100 group-hover/column:opacity-100 pointer-coarse:opacity-100">
        <MoveButton label={`${column.label} nach oben verschieben`} hint="Nach oben" disabled={!canMoveUp} onMove={(target) => onMove(-1, target)}>
          <ArrowUpIcon />
        </MoveButton>
        <MoveButton label={`${column.label} nach unten verschieben`} hint="Nach unten" disabled={!canMoveDown} onMove={(target) => onMove(1, target)}>
          <ArrowDownIcon />
        </MoveButton>
      </span>
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
  const ids = columns.map((column) => column.id);
  const active = new Set(ids);
  const reorder = useColumnReorder(ids, onReorder);
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
        <p className="px-1 text-xs font-medium text-muted-foreground">Angezeigt · zum Sortieren ziehen oder Pfeile nutzen</p>
        <Reorder.Group axis="y" values={ids} onReorder={onReorder} className="flex max-h-56 flex-col overflow-y-auto">
          {columns.map((column) => (
            <ActiveColumn
              key={column.id}
              column={column}
              canMoveUp={reorder.canMove(column.id, -1)}
              canMoveDown={reorder.canMove(column.id, 1)}
              onMove={(offset, target) => reorder.move(column.id, offset, target)}
              onRemove={() => onToggle(column.id)}
            />
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
