import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ClipboardCopyIcon, CodeIcon, TableIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/lib/ease";

export function SelectionToolbar({
  count,
  loaded,
  onCopyKeys,
  onCopyTable,
  onCopyMarkdown,
  onClear,
}: {
  count: number;
  loaded: number;
  onCopyKeys: () => void;
  onCopyTable: () => void;
  onCopyMarkdown: () => void;
  onClear: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          className="flex flex-wrap items-center gap-2 rounded-lg bg-primary/8 px-3 py-2"
          role="region"
          aria-label="Ausgewählte Vorgänge"
        >
          <span
            className="mr-auto text-sm font-medium tabular-nums"
            role="status"
          >
            {count} von {loaded} geladenen Vorgängen ausgewählt
          </span>
          <Button variant="ghost" size="sm" onClick={onCopyKeys}>
            <ClipboardCopyIcon />
            Schlüssel
          </Button>
          <Button variant="ghost" size="sm" onClick={onCopyTable}>
            <TableIcon />
            Tabelle
          </Button>
          <Button variant="ghost" size="sm" onClick={onCopyMarkdown}>
            <CodeIcon />
            Markdown
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Auswahl aufheben"
            onClick={onClear}
          >
            <XIcon />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
