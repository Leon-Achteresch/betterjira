import { setIssueContext, type Workspace } from "@/lib/workspace";

export type NoteEdit = {
  scope: string;
  key: string;
  base: string;
  summary?: string;
  closed?: boolean;
};

export const storedNote = (workspace: Workspace, key: string) => workspace.contexts?.[key]?.note ?? "";

export const activeNoteEdit = (edit: NoteEdit | null, scope: string | undefined) =>
  edit && !edit.closed && edit.scope === scope ? edit : null;

export const noteConflict = (base: string, stored: string, draft: string) =>
  stored !== base && stored !== draft ? stored : null;

export const normalizedNote = (draft: string) => (draft.trim() ? draft : "");

export const writeNote = (workspace: Workspace, key: string, note: string): Workspace =>
  storedNote(workspace, key) === note ? workspace : setIssueContext(workspace, key, { note });

export const restoreNote = (workspace: Workspace, key: string, previous: string): Workspace =>
  storedNote(workspace, key).trim() ? workspace : writeNote(workspace, key, previous);

export const noteFocusKey = (order: readonly string[], visible: readonly string[], key: string) => {
  if (visible.includes(key)) return { key, removed: false };
  const index = order.indexOf(key);
  const after = order.slice(index + 1).find((candidate) => visible.includes(candidate));
  const before = order
    .slice(0, Math.max(index, 0))
    .reverse()
    .find((candidate) => visible.includes(candidate));
  const neighbour = after ?? before ?? visible[0];
  return neighbour ? { key: neighbour, removed: true } : null;
};
