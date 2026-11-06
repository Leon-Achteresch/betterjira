import { ChevronLeft, ChevronRight, EllipsisIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemeCycle } from "@/hooks/use-theme";
import { shortcutHint } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

type HeaderMoreMenuProps = {
  canGoBack: boolean;
  onBack: () => void;
  onForward: () => void;
  className?: string;
};

export function HeaderMoreMenu({ canGoBack, onBack, onForward, className }: HeaderMoreMenuProps) {
  const theme = useThemeCycle();
  return (
    <DropdownMenu>
      <Tooltip content="Weitere Aktionen" side="bottom">
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Weitere Aktionen"
            data-tauri-drag-region="false"
            className={cn("relative after:absolute after:-inset-0.5", className)}
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled={!canGoBack} onSelect={onBack}>
          <ChevronLeft />
          Zurück
          <DropdownMenuShortcut>{shortcutHint("back")}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onForward}>
          <ChevronRight />
          Vorwärts
          <DropdownMenuShortcut>{shortcutHint("forward")}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={theme.cycle}>
          <theme.Icon />
          {theme.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
