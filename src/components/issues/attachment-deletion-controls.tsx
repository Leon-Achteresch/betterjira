import { AnimatePresence, motion } from "motion/react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/motion/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { AttachmentSelectionModel } from "@/hooks/use-attachment-selection";
import { EASE_OUT } from "@/lib/ease";

export function AttachmentSelectionBar({ selection }: { selection: AttachmentSelectionModel }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tooltip content={selection.selecting ? undefined : selection.unavailableReason}>
        <span tabIndex={!selection.selecting && selection.unavailableReason ? 0 : undefined} className="inline-flex rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Button ref={selection.triggerRef} type="button" variant="outline" size="sm" className="min-h-8 rounded-xl" disabled={selection.pending || (!selection.selecting && !!selection.unavailableReason)} onClick={selection.setSelecting}>
            {selection.selecting ? "Auswahl beenden" : "Anhänge auswählen"}
          </Button>
        </span>
      </Tooltip>
      <AnimatePresence initial={false}>
        {selection.selecting && (
          <motion.div key="selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }} transition={{ duration: 0.15, ease: EASE_OUT }} className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="ghost" className="min-h-8 rounded-xl" disabled={selection.pending} onClick={selection.selectVisible}>Sichtbare löschbare auswählen</Button>
            <span role="status" className="text-xs text-muted-foreground tabular-nums">{selection.selectedCount} ausgewählt</span>
            <Button type="button" size="sm" variant="destructive" className="min-h-8 rounded-xl" disabled={selection.pending || !selection.selectedCount} onClick={selection.request}><Trash2Icon />Ausgewählte entfernen…</Button>
          </motion.div>
        )}
      </AnimatePresence>
      <Button type="button" size="sm" variant="ghost" className="min-h-8 rounded-xl" disabled={selection.pending} onClick={selection.refresh}>Anhänge neu prüfen</Button>
    </div>
  );
}

export function AttachmentDeleteDialog({ dialog }: { dialog: AttachmentSelectionModel["dialog"] }) {
  return (
    <AlertDialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg" onCloseAutoFocus={dialog.onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-balance">{dialog.attachments.length} ausgewählte Anhänge endgültig löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Ticket {dialog.issueKey} · {dialog.accountLabel}. Diese Dateien werden aus Jira entfernt. Das lässt sich hier nicht rückgängig machen. Verweise in Beschreibungen und Kommentaren können danach ins Leere führen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul aria-label="Zum Löschen ausgewählte Dateien" className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {dialog.attachments.map((attachment) => (
            <li key={attachment.id} className="min-w-0 rounded-xl bg-muted p-2">
              <p className="break-words font-medium">{attachment.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{attachment.sizeLabel} · ID {attachment.id}</p>
            </li>
          ))}
        </ul>
        {dialog.pending && <p role="status" className="text-xs text-muted-foreground">Dateien werden einzeln geprüft und entfernt. Stoppen betrifft nur noch nicht gesendete Löschungen.</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={dialog.pending}>Abbrechen</AlertDialogCancel>
          {dialog.pending && <Button type="button" variant="outline" onClick={dialog.onStop}>Weitere Löschungen stoppen</Button>}
          <AlertDialogAction variant="destructive" disabled={dialog.pending || !dialog.attachments.length} onClick={(event) => { event.preventDefault(); dialog.onConfirm(); }}>
            {dialog.pending && <Spinner />}Endgültig löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AttachmentDeletionResults({ selection }: { selection: AttachmentSelectionModel }) {
  return (
    <AnimatePresence initial={false}>
      {selection.error && <motion.p key="error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: EASE_OUT }} className="text-xs text-destructive">{selection.error}</motion.p>}
      {selection.results.length > 0 && (
        <motion.section key="results" aria-label="Ergebnis der Anhanglöschung" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: EASE_OUT }} className="max-h-72 overflow-y-auto rounded-2xl border p-3">
          <h3 className="text-sm font-medium text-balance">Ergebnis je Datei</h3>
          <p className="mt-1 text-xs text-muted-foreground">Für einen weiteren Versuch zuerst den Serverstand prüfen und die gewünschte Menge erneut bestätigen.</p>
          <ul className="mt-2 space-y-2 text-xs">
            {selection.results.map((result) => (
              <li key={result.attachment.id} className="min-w-0 break-words">
                <p className="font-medium">{result.name} · ID {result.attachment.id} · {result.label}</p>
                <p className="text-muted-foreground">{result.message}</p>
              </li>
            ))}
          </ul>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
