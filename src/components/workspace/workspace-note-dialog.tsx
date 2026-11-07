import type { KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HistoryIcon } from "lucide-react";
import { PrivateNoteField } from "@/components/issues/issue-note";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { EASE_OUT } from "@/lib/ease";
import { IS_MAC } from "@/lib/platform";

type WorkspaceNoteDialogProps = {
  open: boolean;
  issueKey: string;
  summary?: string;
  draft: string;
  conflict: string | null;
  hadNote: boolean;
  dirty: boolean;
  onDraftChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSave: () => void;
  onCancel: () => void;
  onTakeLatest: () => void;
  onKeepMine: () => void;
  onCloseAutoFocus: (event: Event) => void;
};

export function WorkspaceNoteDialog(props: WorkspaceNoteDialogProps) {
  const reduce = useReducedMotion();
  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onCancel()}>
      <DialogContent
        className="rounded-2xl sm:max-w-lg"
        onCloseAutoFocus={props.onCloseAutoFocus}
        onInteractOutside={(event) => props.dirty && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-balance">
            {props.hadNote ? "Notiz bearbeiten" : "Notiz hinzufügen"} · <span className="font-mono">{props.issueKey}</span>
          </DialogTitle>
          <DialogDescription className={props.summary ? "line-clamp-2" : "sr-only"}>
            {props.summary ?? `Private Notiz zu ${props.issueKey}`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            props.onSave();
          }}
        >
          <PrivateNoteField
            autoFocus
            value={props.draft}
            onChange={(event) => props.onDraftChange(event.target.value)}
            onKeyDown={props.onKeyDown}
            className="max-h-[50vh] min-h-36"
          />
          <AnimatePresence initial={false}>
            {props.conflict !== null && (
              <motion.div
                initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <Alert variant="warning" className="rounded-xl">
                  <HistoryIcon aria-hidden />
                  <AlertTitle>Inzwischen geändert</AlertTitle>
                  <AlertDescription className="flex flex-col gap-2">
                    <span>Die Notiz wurde an anderer Stelle geändert. Dein Entwurf bleibt erhalten.</span>
                    <span className="line-clamp-3 rounded-xl bg-background/60 px-2 py-1 break-words whitespace-pre-wrap text-foreground">
                      {props.conflict || "Notiz wurde entfernt."}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={props.onTakeLatest}>
                        Aktuellen Stand übernehmen
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={props.onKeepMine}>
                        Meinen Entwurf behalten
                      </Button>
                    </span>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>
          <DialogFooter className="items-center rounded-b-2xl">
            <span className="mr-auto hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
              <KbdGroup>
                <Kbd>{IS_MAC ? "⌘" : "Strg"}</Kbd>
                <Kbd>Enter</Kbd>
              </KbdGroup>
              speichert
            </span>
            <Button type="button" variant="ghost" onClick={props.onCancel}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={props.conflict !== null}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
