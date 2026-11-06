import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDownIcon, ClipboardCopyIcon, CodeIcon, DownloadIcon, FileSpreadsheetIcon, FileTextIcon, TableIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EASE_OUT } from "@/lib/ease";

export function SelectionToolbar({
  count,
  loaded,
  disabled = false,
  onCopyKeys,
  onCopyTable,
  onCopyMarkdown,
  onDownloadCsv,
  onDownloadTsv,
  onClear,
}: {
  count: number;
  loaded: number;
  disabled?: boolean;
  onCopyKeys: () => void;
  onCopyTable: () => void;
  onCopyMarkdown: () => void;
  onDownloadCsv: () => void;
  onDownloadTsv: () => void;
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
          <Button variant="ghost" size="sm" onClick={onCopyKeys} disabled={disabled}>
            <ClipboardCopyIcon />
            Schlüssel
          </Button>
          <Button variant="ghost" size="sm" onClick={onCopyTable} disabled={disabled}>
            <TableIcon />
            Tabelle
          </Button>
          <Button variant="ghost" size="sm" onClick={onCopyMarkdown} disabled={disabled}>
            <CodeIcon />
            Markdown
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={disabled}>
                <DownloadIcon />
                Datei
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel className="tabular-nums">Ausgewählte Tickets: {count}</DropdownMenuLabel>
              <DropdownMenuItem disabled={disabled} onSelect={onDownloadCsv}>
                <FileSpreadsheetIcon />
                CSV-Datei herunterladen
              </DropdownMenuItem>
              <DropdownMenuItem disabled={disabled} onSelect={onDownloadTsv}>
                <FileTextIcon />
                TSV-Datei herunterladen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
