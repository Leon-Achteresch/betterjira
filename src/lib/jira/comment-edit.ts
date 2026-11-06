import { adfToEditor, editorToAdf, hasSendableContent, isAdfDoc, isBlankAdf, isEditableAdf, sameAdf, type AdfNode } from "./adf";

export const NOT_EDITABLE_HINT = "Enthält Inhalte, die sich nur in Jira bearbeiten lassen";

export const canEditContent = (body: unknown): body is AdfNode => isAdfDoc(body) && isEditableAdf(body);

export const editBaseline = (body: unknown): AdfNode | undefined => (canEditContent(body) ? editorToAdf(adfToEditor(body)) : undefined);

export const editBlockReason = (body: unknown): string | undefined => (canEditContent(body) ? undefined : NOT_EDITABLE_HINT);

export const canSaveEdit = (value: AdfNode | undefined, baseline: AdfNode | undefined, pending: boolean) =>
  !!value && !!baseline && !pending && hasSendableContent(value) && !sameAdf(value, baseline);

export const editDraftToKeep = (value: AdfNode | undefined, baseline: AdfNode | undefined): AdfNode | undefined =>
  value && !isBlankAdf(value) && !sameAdf(value, baseline) ? value : undefined;

export const editErrorFor = (openCommentId: string | undefined, failedCommentId: string | undefined, message: string | undefined) =>
  openCommentId !== undefined && openCommentId === failedCommentId ? message : undefined;

export const saveFailureNotice = (stillOpenCommentId: string | undefined, failedCommentId: string): "inline" | "toast" =>
  stillOpenCommentId === failedCommentId ? "inline" : "toast";
