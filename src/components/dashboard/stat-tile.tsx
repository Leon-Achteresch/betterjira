import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { StaggerItem } from "@/components/motion/stagger";
import { cn } from "@/lib/utils";

const statTileVariants = cva("flex flex-col gap-1 rounded-xl bg-card p-3 ring-1 ring-foreground/10", {
  variants: {
    tone: {
      default: "",
      warning: "ring-amber-500/40",
      critical: "ring-destructive/40",
    },
  },
  defaultVariants: { tone: "default" },
});

type StatTileProps = VariantProps<typeof statTileVariants> & {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function StatTile({ label, value, hint, icon, tone, className }: StatTileProps) {
  return (
    <StaggerItem className={cn(statTileVariants({ tone }), className)}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span className="font-heading text-2xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </StaggerItem>
  );
}
