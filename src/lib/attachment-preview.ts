import { sortAttachments, type SortableAttachment } from "@/lib/attachment-sort";

export const ATTACHMENT_PREVIEW_LIMIT = 6;

export const attachmentPreview = <T extends SortableAttachment>(attachments: readonly T[], limit = ATTACHMENT_PREVIEW_LIMIT) => {
  const newest = sortAttachments(attachments, "newest");
  return { shown: newest.slice(0, limit), hidden: Math.max(newest.length - limit, 0) };
};
