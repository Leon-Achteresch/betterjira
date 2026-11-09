import { useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { useWorkspace, useWorkspaceStorageSync, useWorkspaceStore } from "@/hooks/use-workspace";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type { WorkspaceEntry } from "@/lib/workspace-page";
import {
  activeNoteEdit,
  noteConflict,
  noteFocusKey,
  normalizedNote,
  restoreNote,
  storedNote,
  writeNote,
  type NoteEdit,
} from "@/lib/workspace-note";

const entrySelector = (key: string) => `[data-workspace-entry="${CSS.escape(key)}"]`;

export function useWorkspaceNoteEditor(visible: readonly WorkspaceEntry[]) {
  const latestVisible = useLatestRef(visible);
  const { id, workspace } = useWorkspace();
  const updateScope = useWorkspaceStore((state) => state.update);
  const [edit, setEdit] = useState<NoteEdit | null>(null);
  const [draft, setDraft] = useState("");
  const currentScope = useRef(id);
  currentScope.current = id;
  const returnTo = useRef<{ key: string; order: readonly string[] } | null>(null);
  if (edit && edit.scope !== id) setEdit(null);
  const session = activeNoteEdit(edit, id);
  const stored = session ? storedNote(workspace, session.key) : "";
  const conflict = session ? noteConflict(session.base, stored, draft) : null;
  useWorkspaceStorageSync(!!id);
  const close = () => setEdit((current) => current && { ...current, closed: true });

  const save = () => {
    if (!session || session.scope !== currentScope.current) return;
    const { scope, key, base } = session;
    const previous = storedNote(useWorkspaceStore.getState().workspaces[scope] ?? EMPTY_WORKSPACE, key);
    if (noteConflict(base, previous, draft) !== null) return;
    const note = normalizedNote(draft);
    close();
    if (note === previous) return;
    updateScope(scope, (current) => writeNote(current, key, note));
    if (!note)
      toast("Notiz entfernt", {
        id: `note-removed:${scope}:${key}`,
        description: key,
        duration: 8000,
        action: { label: "Rückgängig", onClick: () => updateScope(scope, (current) => restoreNote(current, key, previous)) },
      });
  };

  return {
    open: !!session,
    issueKey: edit?.key ?? "",
    summary: edit?.summary,
    draft,
    conflict,
    hadNote: !!edit?.base.trim(),
    dirty: !!session && draft !== session.base,
    setDraft,
    start: (entry: WorkspaceEntry) => {
      if (!id || id !== currentScope.current) return;
      const base = storedNote(workspace, entry.key);
      returnTo.current = { key: entry.key, order: visible.map((item) => item.key) };
      setDraft(base);
      setEdit({ scope: id, key: entry.key, base, summary: entry.known ? entry.summary : undefined });
    },
    save,
    cancel: close,
    takeLatest: () => {
      if (!session) return;
      setDraft(stored);
      setEdit({ ...session, base: stored });
    },
    keepMine: () => {
      if (session) setEdit({ ...session, base: stored });
    },
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
        event.preventDefault();
        save();
      }
    },
    onCloseAutoFocus: (event: Event) => {
      const origin = returnTo.current;
      returnTo.current = null;
      if (!origin) return;
      const target = noteFocusKey(
        origin.order,
        latestVisible.current.map((item) => item.key),
        origin.key,
      );
      const element =
        (target &&
          document
            .querySelector(entrySelector(target.key))
            ?.querySelector<HTMLElement>(target.removed ? "a" : "[data-note-trigger]")) ||
        document.querySelector<HTMLElement>("[data-workspace-search]");
      if (!element) return;
      event.preventDefault();
      element.focus();
    },
  };
}
