import { sameAttachment, type AttachmentSnapshot, type AttachmentDeleteResult } from "./jira/attachment-deletion";

export type AttachmentSelection = {
  context: string;
  selecting: boolean;
  ids: string[];
  confirmation: readonly AttachmentSnapshot[] | null;
  results: readonly AttachmentDeleteResult[];
};

export const emptyAttachmentSelection = (context: string): AttachmentSelection => ({ context, selecting: false, ids: [], confirmation: null, results: [] });

export const reconcileAttachmentSelection = (state: AttachmentSelection, context: string, eligible: readonly AttachmentSnapshot[], locked = false): AttachmentSelection => {
  if (state.context !== context) return emptyAttachmentSelection(context);
  if (locked) return state;
  const selected = eligible.filter((entry) => state.ids.includes(entry.id));
  const ids = state.ids.filter((id) => selected.some((entry) => entry.id === id));
  const confirmation = state.confirmation && state.confirmation.length === selected.length
    && state.confirmation.every((entry) => selected.some((current) => sameAttachment(entry, current))) ? state.confirmation : null;
  return ids.length === state.ids.length && confirmation === state.confirmation ? state : { ...state, ids, confirmation };
};
