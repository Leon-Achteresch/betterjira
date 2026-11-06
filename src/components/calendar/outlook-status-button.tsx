import { AnimatePresence, motion } from "motion/react";
import { CalendarSyncIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OutlookAccount } from "@/lib/calendar/model";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

type OutlookStatusButtonProps = {
  account: OutlookAccount | null;
  pending: boolean;
  failed: boolean;
  onClick: () => void;
};

export function OutlookStatusButton({ account, pending, failed, onClick }: OutlookStatusButtonProps) {
  const label = pending ? "Outlook …" : account ? account.displayName || "Outlook" : failed ? "Outlook nicht erreichbar" : "Outlook verbinden";
  return (
    <Button variant="outline" size="sm" onClick={onClick} aria-label={`Outlook-Verbindung: ${label}`}>
      <CalendarSyncIcon />
      <span
        className={cn(
          "size-1.5 rounded-full transition-colors",
          account ? "bg-emerald-500" : failed ? "bg-amber-500" : "bg-muted-foreground/40",
        )}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.16, ease: EASE_OUT }}
          className="max-w-40 truncate"
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
