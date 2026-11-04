import { AnimatePresence, motion } from "motion/react";
import { CheckIcon, LockKeyholeIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useIssueNote } from "@/hooks/use-issue-note";
import { EASE_OUT } from "@/lib/ease";

export function IssueNote({ issueKey }: { issueKey: string }) {
  const editor = useIssueNote(issueKey);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LockKeyholeIcon className="size-4" />
        Nur für dich. Wird nicht in Jira veröffentlicht.
      </div>
      <Textarea
        aria-label="Private Notiz"
        placeholder="Wo warst du? Was ist dein nächster Schritt?"
        value={editor.note}
        onChange={(event) => editor.setNote(event.target.value)}
        disabled={!editor.ready}
        maxLength={4000}
        className="min-h-48"
      />
      <AnimatePresence initial={false}>
        {editor.note && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            role="status"
          >
            <CheckIcon className="size-3.5 text-success" />
            Auf diesem Gerät gespeichert
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
