import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon, RotateCwIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { NAV_TAB_CLASS, NavTabIndicator, NavTabs } from "@/components/motion/nav-tabs";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EASE_OUT } from "@/lib/ease";
import type { TimeRangePreset, TimeRangeSearch } from "@/lib/time-tracking/range";

type Preset = { id: TimeRangePreset; label: string; search: TimeRangeSearch; active: boolean };

export function TimeRangeBar({
  presets,
  label,
  rangeKey,
  previousLabel,
  nextLabel,
  refreshing,
  onPrevious,
  onNext,
  onRefresh,
}: {
  presets: readonly Preset[];
  label: string;
  rangeKey: string;
  previousLabel: string;
  nextLabel: string;
  refreshing: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onRefresh: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <NavTabs id="time-range-presets" label="Zeitraum" className="mr-auto">
        {presets.map((preset) => (
          <Link
            key={preset.id}
            to="/zeiterfassung"
            search={preset.search}
            activeOptions={{ exact: true }}
            aria-current={preset.active ? "page" : undefined}
            className={NAV_TAB_CLASS}
          >
            {preset.label}
            {preset.active && <NavTabIndicator />}
          </Link>
        ))}
      </NavTabs>
      <div className="flex min-w-0 items-center gap-1">
        <Tooltip content={previousLabel} side="bottom">
          <Button variant="ghost" size="icon" aria-label={previousLabel} onClick={onPrevious}>
            <ChevronLeftIcon />
          </Button>
        </Tooltip>
        <div className="relative h-8 min-w-0 overflow-hidden px-1">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={rangeKey}
              initial={{ opacity: 0, y: reduce ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              aria-live="polite"
              className="truncate text-sm leading-8 font-medium tabular-nums"
            >
              {label}
            </motion.p>
          </AnimatePresence>
        </div>
        <Tooltip content={nextLabel} side="bottom">
          <Button variant="ghost" size="icon" aria-label={nextLabel} onClick={onNext}>
            <ChevronRightIcon />
          </Button>
        </Tooltip>
        <Tooltip content="Aktualisieren" side="bottom">
          <Button variant="ghost" size="icon" aria-label="Aktualisieren" aria-busy={refreshing} onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Spinner /> : <RotateCwIcon />}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
