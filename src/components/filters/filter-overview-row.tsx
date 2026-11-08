import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRightIcon, FunnelIcon, StarIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

const MotionButton = motion.create(Button);

type FilterOverviewRowProps = {
  id: string;
  name: string;
  favourite: boolean;
  pending: boolean;
  onToggleFavourite: () => void;
};

export function FilterOverviewRow({ id, name, favourite, pending, onToggleFavourite }: FilterOverviewRowProps) {
  const reduce = useReducedMotion();
  const label = favourite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen";
  return (
    <div className="group flex items-center gap-1 rounded-xl p-1 transition-colors hover:bg-muted/60 has-[a:focus-visible]:bg-muted/60">
      <Link
        to="/filter/$id"
        params={{ id }}
        className="flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <FunnelIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
        <ChevronRightIcon
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </Link>
      <Tooltip content={label}>
        <MotionButton
          variant="ghost"
          size="icon"
          aria-label={`„${name}“ ${favourite ? "aus Favoriten entfernen" : "zu Favoriten hinzufügen"}`}
          aria-pressed={favourite}
          aria-busy={pending || undefined}
          disabled={pending}
          onClick={onToggleFavourite}
          whileTap={reduce ? undefined : { scale: 0.96 }}
          transition={SPRING_PRESS}
          className={cn("text-muted-foreground", favourite && "text-warning")}
        >
          {pending ? (
            <Spinner aria-hidden />
          ) : (
            <StarIcon
              className={cn("transition-[color,fill] duration-200", favourite ? "fill-current" : "fill-transparent")}
            />
          )}
        </MotionButton>
      </Tooltip>
    </div>
  );
}
