import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PlayIcon, SaveIcon, Undo2Icon } from "lucide-react";
import { JqlEditor } from "@/components/issues/jql-editor";
import { NameDialog } from "@/components/issues/name-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { FilterEditorState } from "@/hooks/use-filter-editor";
import { EASE_OUT } from "@/lib/ease";

export function FilterJqlPanel({ editor }: { editor: FilterEditorState }) {
  const reduce = useReducedMotion();
  const [copying, setCopying] = useState(false);
  const invalid = editor.errors.length > 0;

  return (
    <AnimatePresence initial={false}>
      {editor.editing && (
        <motion.section
          initial={{ opacity: 0, y: reduce ? 0 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -4, transition: { duration: 0.15, ease: EASE_OUT } }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="rounded-xl border bg-muted/30 p-3"
        >
          <JqlEditor
            value={editor.value}
            onChange={editor.setValue}
            onApply={editor.apply}
            errors={editor.errors}
            validating={editor.validating}
          >
            <Button size="sm" variant="secondary" onClick={editor.apply} disabled={invalid || !editor.value.trim()}>
              <PlayIcon />
              Vorschau
            </Button>
            {editor.isOwner && (
              <Button size="sm" onClick={editor.save} disabled={!editor.dirty || invalid || editor.saving}>
                {editor.saving ? <Spinner /> : <SaveIcon />}
                Speichern
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={!editor.value.trim() || invalid}
              onClick={() => {
                editor.resetCreate();
                setCopying(true);
              }}
            >
              Als neuen Filter…
            </Button>
            <AnimatePresence initial={false}>
              {(editor.dirty || editor.previewing) && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.16, ease: EASE_OUT }}
                >
                  <Button size="sm" variant="ghost" onClick={editor.discard}>
                    <Undo2Icon />
                    Verwerfen
                  </Button>
                </motion.span>
              )}
            </AnimatePresence>
          </JqlEditor>
          {!editor.isOwner && editor.filter && (
            <p className="mt-2 text-xs text-muted-foreground">
              Dieser Filter gehört {editor.filter.owner?.displayName ?? "jemand anderem"}. Änderungen kannst du als eigenen Filter speichern.
            </p>
          )}
          <NameDialog
            open={copying}
            onOpenChange={setCopying}
            title="Als neuen Filter speichern"
            initial={editor.filter ? `${editor.filter.name} (Kopie)` : ""}
            submitLabel="Anlegen"
            pending={editor.creating}
            error={editor.createError}
            onSubmit={editor.saveAs}
          />
        </motion.section>
      )}
    </AnimatePresence>
  );
}
