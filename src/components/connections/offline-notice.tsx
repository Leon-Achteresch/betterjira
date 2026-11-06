import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { WifiOffIcon } from "lucide-react";
import { EASE_OUT } from "@/lib/ease";

export function OfflineNotice({ visible }: { visible: boolean }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          role="status"
          data-testid="offline-notice"
          initial={{ opacity: 0, y: reduce ? 0 : -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -4, transition: { duration: 0.14, ease: EASE_OUT } }}
          transition={{ duration: 0.24, ease: EASE_OUT }}
          className="px-4 pt-3 sm:px-8"
        >
          <div className="flex items-start gap-2.5 rounded-2xl border border-warning/25 bg-warning/10 px-3.5 py-2.5 text-sm">
            <WifiOffIcon className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} />
            <p>
              <span className="font-medium">Gerät meldet offline;</span>{" "}
              <span className="text-muted-foreground">angezeigte Daten können veraltet sein. Geladene Daten und Entwürfe bleiben erhalten.</span>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
