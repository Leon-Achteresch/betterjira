import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleCheckIcon, CircleDashedIcon, CircleDotIcon } from "lucide-react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

const palette: Record<string, string> = {
  yellow: "bg-info/12 text-info",
  green: "bg-success/12 text-success",
};

export function JiraStatusBadge({
  status,
  className,
}: {
  status: { name: string; statusCategory: { colorName: string } };
  className?: string;
}) {
  const reduce = useReducedMotion();
  const Icon =
    status.statusCategory.colorName === "green"
      ? CircleCheckIcon
      : status.statusCategory.colorName === "yellow"
        ? CircleDotIcon
        : CircleDashedIcon;
  return (
    <Badge
      className={cn(
        "gap-1.5 uppercase tracking-wide",
        palette[status.statusCategory.colorName] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={`${status.name}:${status.statusCategory.colorName}`}
          initial={{ opacity: 0, y: reduce ? 0 : 5, scale: reduce ? 1 : 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reduce ? 0 : -4, transition: { duration: 0.12 } }}
          transition={{ duration: 0.32, ease: EASE_OUT }}
          className="inline-flex items-center gap-1.5"
        >
          <Icon aria-hidden className="size-3" />
          {status.name}
        </motion.span>
      </AnimatePresence>
    </Badge>
  );
}
