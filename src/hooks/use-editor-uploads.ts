import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { insertUpload, type EditorFileHandler } from "@/lib/jira/adf-uploads";

export function useEditorUploads(handler: EditorFileHandler | undefined, onUploadingChange?: (uploading: boolean) => void) {
  const [pending, setPending] = useState(0);
  const latest = useRef({ handler, onUploadingChange });
  useLayoutEffect(() => {
    latest.current = { handler, onUploadingChange };
  });
  const uploading = pending > 0;
  useLayoutEffect(() => {
    latest.current.onUploadingChange?.(uploading);
  }, [uploading]);

  const insert = useCallback((view: EditorView, files: readonly File[], pos: number, moveCursor = false) => {
    const current = latest.current.handler;
    const accepted = current ? files.filter(current.accepts) : [];
    if (!current || accepted.length === 0) return false;
    if (moveCursor) {
      view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos))));
      view.focus();
    }
    const at = view.state.selection.empty ? view.state.selection.from : pos;
    for (const file of accepted) {
      setPending((count) => count + 1);
      void insertUpload(view, at, file, current.add)
        .catch(() => undefined)
        .finally(() => setPending((count) => count - 1));
    }
    return true;
  }, []);

  return { uploading, insert, enabled: handler !== undefined };
}
