import { CopyPlusIcon, EllipsisIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type RolloutMoreMenuProps = {
  onDuplicate: () => void;
};

export function RolloutMoreMenu({ onDuplicate }: RolloutMoreMenuProps) {
  return (
    <DropdownMenu>
      <Tooltip content="Weitere Aktionen">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Weitere Aktionen">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" collisionPadding={8} className="w-56 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none">
        <DropdownMenuItem className="min-h-8" onSelect={onDuplicate}>
          <CopyPlusIcon />
          Als Vorlage duplizieren
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
