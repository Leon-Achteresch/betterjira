import { SearchIcon, TerminalSquareIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/ease";
import type { SearchMode } from "@/lib/search/search-params";

const DESCRIPTIONS: Record<SearchMode, string> = {
  einfach: "Alle Vorgänge durchsuchen, nach Projekt eingrenzen und filtern.",
  jql: "Frei mit JQL abfragen, prüfen und als Filter speichern.",
};

export function SearchHeader({ mode, connected }: { mode: SearchMode; connected: boolean }) {
  const reduce = useReducedMotion();
  const Icon = mode === "jql" ? TerminalSquareIcon : SearchIcon;
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-balance">Ticketsuche</h1>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={connected ? mode : "signed-out"}
            initial={{ opacity: 0, y: reduce ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="text-sm text-muted-foreground"
          >
            {connected ? DESCRIPTIONS[mode] : "Vorgänge in allen Jira-Projekten finden."}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
