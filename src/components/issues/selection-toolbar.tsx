import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ClipboardCopyIcon, CodeIcon, TableIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/motion/tooltip";
import { BulkEditMenu } from "@/components/issues/bulk-edit-menu";
import type { BulkEditState } from "@/hooks/jira/use-bulk-edit";
import { EASE_OUT } from "@/lib/ease";

export function SelectionToolbar({
  count,
  loaded,
  disabled = false,
  bulk,
  onCopyKeys,
  onCopyTable,
  onCopyMarkdown,
  onClear,
}: {
  count: number;
  loaded: number;
  disabled?: boolean;
  bulk?: BulkEditState;
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
          className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/8 px-3 py-2"
          role="region"
          aria-label="Ausgewählte Vorgänge"
        >
          <span
            className="mr-auto text-sm font-medium tabular-nums"
            role="status"
          >
            {count} von {loaded} geladenen Vorgängen ausgewählt
          </span>
          {bulk && <BulkEditMenu state={bulk} disabled={disabled} />}
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopyKeys}
            disabled={disabled}
          >
            <ClipboardCopyIcon />
            Schlüssel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopyTable}
            disabled={disabled}
          >
            <TableIcon />
            Tabelle
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopyMarkdown}
            disabled={disabled}
          >
            <CodeIcon />
            Markdown
          </Button>
          <Tooltip content="Auswahl aufheben">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Auswahl aufheben"
              disabled={disabled || bulk?.pending}
              onClick={onClear}
            >
              <XIcon />
            </Button>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
