import { Schema } from "effect";

export const FieldDraft = Schema.Struct({
  text: Schema.String,
  revision: Schema.String,
});

export type FieldDraft = typeof FieldDraft.Type;
export const FieldDrafts = Schema.Record(Schema.String, FieldDraft);
export type FieldDrafts = typeof FieldDrafts.Type;

export const fieldDraftId = (cloudId: string, accountId: string, issueKey: string, field: string) =>
  JSON.stringify([cloudId, accountId, issueKey, field]);

export const replaceFieldDraft = (drafts: FieldDrafts, id: string, text: string, revision: string): FieldDrafts => ({
  ...drafts,
  [id]: { text, revision },
});

export const removeFieldDraft = (drafts: FieldDrafts, id: string): FieldDrafts => {
  const { [id]: previous, ...remaining } = drafts;
  return remaining;
};

export const isSubmittedFieldDraft = (current: FieldDraft | undefined, submitted: FieldDraft) =>
  current?.revision === submitted.revision && current.text === submitted.text;

export const clearSubmittedFieldDraft = (drafts: FieldDrafts, id: string, submitted: FieldDraft): FieldDrafts =>
  isSubmittedFieldDraft(drafts[id], submitted) ? removeFieldDraft(drafts, id) : drafts;
