import { StarIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FavoriteButton({ name, favorite, onToggle, disabled = false }: {
  name: string;
  favorite: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip content={favorite ? "Aus Favoriten entfernen" : "Favorisieren"}>
      <Button
        variant="ghost"
        size="icon"
        aria-pressed={favorite}
        aria-label={favorite ? `${name} aus Favoriten entfernen` : `${name} favorisieren`}
        onClick={onToggle}
        disabled={disabled}
      >
        <StarIcon className={cn(favorite ? "fill-current text-amber-500" : "text-muted-foreground")} />
      </Button>
    </Tooltip>
  );
}
