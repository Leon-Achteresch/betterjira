import { StarIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FavoriteButton({ name, favorite, onToggle }: { name: string; favorite: boolean; onToggle: () => void }) {
  return (
    <Tooltip content={favorite ? "Aus Favoriten entfernen" : "Favorisieren"}>
      <Button
        variant="ghost"
        size="icon"
        aria-pressed={favorite}
        aria-label={favorite ? `${name} aus Favoriten entfernen` : `${name} favorisieren`}
        onClick={onToggle}
      >
        <StarIcon className={cn(favorite ? "fill-current text-amber-500" : "text-muted-foreground")} />
      </Button>
    </Tooltip>
  );
}
