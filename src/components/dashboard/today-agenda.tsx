import { motion, useReducedMotion } from "motion/react";
import { ArrowRightIcon, BellIcon, CalendarClockIcon, CircleCheckIcon, CircleDotIcon, ClockIcon, FlagIcon, type LucideIcon } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { SPRING_PRESS } from "@/lib/ease";
import type { AgendaItem } from "@/lib/today-agenda";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  inbox: BellIcon,
  due: FlagIcon,
  rollout: CalendarClockIcon,
  stale: CircleDotIcon,
  time: ClockIcon,
};

type TodayAgendaProps = { items: AgendaItem[]; urgent: number; onSelect: (item: AgendaItem) => void };

export function TodayAgenda({ items, urgent, onSelect }: TodayAgendaProps) {
  const reduce = useReducedMotion();

  return (
    <section aria-labelledby="today-agenda-title" className="glass-card flex flex-col gap-3 rounded-2xl p-4">
      <h2 id="today-agenda-title" className="flex items-baseline gap-2">
        <span className="font-medium">Heute zu tun</span>
        {urgent > 0 && <span className="text-sm text-muted-foreground tabular-nums">{urgent} dringend</span>}
      </h2>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          <CircleCheckIcon className="size-4 text-success" />
          Nichts Dringendes. Du kannst direkt mit deinen Tickets loslegen.
        </p>
      ) : (
        <Stagger className="flex flex-col gap-1">
          {items.map((item) => {
            const Icon = ICONS[item.id] ?? CircleDotIcon;
            return (
              <StaggerItem key={item.id} className="flex">
                <motion.button
                  type="button"
                  onClick={() => onSelect(item)}
                  whileHover={reduce ? undefined : { x: 2 }}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                  transition={SPRING_PRESS}
                  className={cn(
                    "group flex min-h-20 w-full flex-col items-start gap-1.5 rounded-xl px-3 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
                    item.tone === "urgent" && "bg-muted/70",
                  )}
                >
                  <span className="flex w-full items-center gap-2 text-sm font-medium">
                    <Icon className={cn("size-4 shrink-0", item.tone === "urgent" ? "text-warning" : "text-muted-foreground")} />
                    <span className="truncate">{item.title}</span>
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{item.detail}</span>
                  <span className="flex items-center gap-1 text-xs font-medium text-foreground/80 group-hover:text-foreground">
                    {item.action}
                    <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </span>
                </motion.button>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </section>
  );
}
