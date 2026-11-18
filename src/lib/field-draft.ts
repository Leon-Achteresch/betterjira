import { Schema } from "effect";
import { isAdfDoc, type AdfNode } from "./jira/adf";
import { DescriptionBasis, sameDescription } from "./description-comparison";

export const FieldDraft = Schema.Struct({
  text: Schema.String,
  revision: Schema.String,
  basis: Schema.optional(DescriptionBasis),
});

export type FieldDraft = typeof FieldDraft.Type;
export const FieldDrafts = Schema.Record(Schema.String, FieldDraft);
export type FieldDrafts = typeof FieldDrafts.Type;

export const fieldDraftId = (cloudId: string, accountId: string, issueKey: string, field: string) =>
  JSON.stringify([cloudId, accountId, issueKey, field]);

export const adfDraftField = (field: string) => `${field}#adf`;

export const EMPTY_ADF_DRAFT = JSON.stringify({ type: "doc", version: 1, content: [{ type: "paragraph" }] });

export const parseAdfDraft = (text: string): AdfNode | undefined => {
  try {
    const doc: unknown = JSON.parse(text);
    return isAdfDoc(doc) ? doc : undefined;
  } catch {
    return undefined;
  }
};

export const replaceFieldDraft = (drafts: FieldDrafts, id: string, text: string, revision: string, initialBasis?: DescriptionBasis): FieldDrafts => {
  const basis = drafts[id] ? drafts[id].basis : initialBasis;
  return { ...drafts, [id]: { text, revision, ...(basis && { basis }) } };
};

export const removeFieldDraft = (drafts: FieldDrafts, id: string): FieldDrafts => {
  const { [id]: previous, ...remaining } = drafts;
  return remaining;
};

export const isSubmittedFieldDraft = (current: FieldDraft | undefined, submitted: FieldDraft) =>
  current?.revision === submitted.revision && current.text === submitted.text;

export const clearSubmittedFieldDraft = (drafts: FieldDrafts, id: string, submitted: FieldDraft): FieldDrafts =>
  isSubmittedFieldDraft(drafts[id], submitted) ? removeFieldDraft(drafts, id) : drafts;

export const rebaseNewerFieldDraft = (drafts: FieldDrafts, id: string, submitted: FieldDraft, basis?: DescriptionBasis): FieldDrafts => {
  const current = drafts[id];
  if (!current || !basis || !current.basis || !submitted.basis || !sameDescription(current.basis, submitted.basis)) return drafts;
  return { ...drafts, [id]: { ...current, basis } };
};
