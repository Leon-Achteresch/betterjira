import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArchiveRestoreIcon, PinIcon } from "lucide-react";
import { useState } from "react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EASE_OUT, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

const VISIBLE_KEYS = 8;

export type LegacyTabsOfferData = {
  keys: readonly string[];
  pinned: readonly string[];
  label: string;
  siteName: string;
  onAdopt: () => void;
  onDiscard: () => void;
};

type LegacyTabsOfferProps = {
  offer?: LegacyTabsOfferData;
  className?: string;
};

const MotionButton = motion.create(Button);

export function LegacyTabsOffer({ offer, className }: LegacyTabsOfferProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <AnimatePresence initial={false}>
      {offer ? (
        <motion.div
          key="legacy-tabs"
          data-tauri-drag-region="false"
          initial={{ opacity: 0, y: reduce ? 0 : -4 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } }}
          exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
          className={cn("flex shrink-0 items-center px-1", className)}
        >
          <Popover open={open} onOpenChange={setOpen}>
            <Tooltip content="Tabs aus früherer Version übernehmen oder verwerfen" side="bottom">
              <PopoverTrigger asChild>
                <MotionButton
                  variant="ghost"
                  size="sm"
                  aria-label={`${offer.label} ohne Konto, übernehmen oder verwerfen`}
                  whileTap={reduce ? undefined : { scale: 0.96 }}
                  transition={SPRING_PRESS}
                  className="relative h-8 min-w-8 rounded-xl px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArchiveRestoreIcon />
                  <span className="hidden tabular-nums sm:inline">{offer.label}</span>
                  <span aria-hidden className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary sm:static" />
                </MotionButton>
              </PopoverTrigger>
            </Tooltip>
            <PopoverContent align="start" collisionPadding={16} className="w-80 max-w-[calc(100vw-2rem)] gap-3 rounded-2xl p-3">
              <PopoverHeader>
                <PopoverTitle className="text-balance">{offer.label} ohne Konto</PopoverTitle>
                <PopoverDescription className="text-xs">
                  Diese Tabs stammen aus einer früheren Version und gehören noch zu keinem Konto. Übernimm sie in{" "}
                  {offer.siteName} oder verwirf sie.
                </PopoverDescription>
              </PopoverHeader>
              <ul aria-label="Frühere Tabs" className="flex flex-wrap gap-1">
                {offer.keys.slice(0, VISIBLE_KEYS).map((key) => (
                  <li key={key} className="inline-flex items-center gap-1 rounded-xl bg-muted px-2 py-0.5 font-mono text-xs">
                    {offer.pinned.includes(key) ? <PinIcon aria-label="Angeheftet" className="size-3" /> : null}
                    {key}
                  </li>
                ))}
                {offer.keys.length > VISIBLE_KEYS ? (
                  <li className="inline-flex items-center px-1 text-xs text-muted-foreground tabular-nums">
                    +{offer.keys.length - VISIBLE_KEYS} weitere
                  </li>
                ) : null}
              </ul>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" className="h-8 rounded-xl" onClick={() => run(offer.onDiscard)}>
                  Verwerfen
                </Button>
                <Button size="sm" className="h-8 rounded-xl" onClick={() => run(offer.onAdopt)}>
                  Übernehmen
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
