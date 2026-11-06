import type { ReactNode } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export const NAV_TAB_CLASS =
  "relative shrink-0 rounded-sm px-3 pb-2 text-sm whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:text-foreground";

export function NavTabs({ id, label, className, children }: { id: string; label: string; className?: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className={cn("flex max-w-full gap-1 overflow-x-auto border-b", className)}>
      <LayoutGroup id={id}>{children}</LayoutGroup>
    </nav>
  );
}

export function NavTabIndicator() {
  const reduce = useReducedMotion();
  return (
    <motion.span
      layoutId="nav-tab-indicator"
      transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
      className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-foreground"
    />
  );
}
