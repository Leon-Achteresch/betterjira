import { FilterIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SPRING_SWAP } from "@/lib/ease";

export type FacetMenuOption = { value: string; label: string; iconUrl?: string; avatarUrl?: string };
export type FacetMenuGroup<Id extends string> = { id: Id; label: string; options: FacetMenuOption[]; selected: string[] };

export function FacetOptionIcon({ option }: { option: FacetMenuOption }) {
  if (option.avatarUrl) {
    return (
      <Avatar size="sm" className="size-4">
        <AvatarImage src={option.avatarUrl} alt="" />
        <AvatarFallback className="text-[0.5rem]">{option.label.charAt(0)}</AvatarFallback>
      </Avatar>
    );
  }
  if (option.iconUrl) return <img src={option.iconUrl} alt="" className="size-4 shrink-0" />;
  return null;
}

export function FacetMenu<Id extends string>({
  groups,
  count,
  onToggle,
  onClear,
}: {
  groups: FacetMenuGroup<Id>[];
  count: number;
  onToggle: (group: Id, value: string) => void;
  onClear: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={count > 0 ? "secondary" : "outline"} size="sm">
          <FilterIcon />
          Filter
          <AnimatePresence initial={false} mode="popLayout">
            {count > 0 && (
              <motion.span
                key={count}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
                transition={SPRING_SWAP}
                className="rounded-full bg-primary px-1.5 text-[0.65rem] leading-4 text-primary-foreground tabular-nums"
              >
                {count}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {groups.map((group) => (
          <DropdownMenuSub key={group.id}>
            <DropdownMenuSubTrigger disabled={group.options.length === 0}>
              <span className="flex-1">{group.label}</span>
              {group.selected.length > 0 && <span className="text-xs text-primary tabular-nums">{group.selected.length}</span>}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 min-w-52 overflow-y-auto">
              {group.options.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={group.selected.includes(option.value)}
                  onCheckedChange={() => onToggle(group.id, option.value)}
                  onSelect={(event) => event.preventDefault()}
                >
                  <FacetOptionIcon option={option} />
                  <span className="truncate">{option.label}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={count === 0} onSelect={onClear}>
          Filter zurücksetzen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
