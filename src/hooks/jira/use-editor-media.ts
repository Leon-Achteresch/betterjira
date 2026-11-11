import { createContext, use, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdfMedia } from "@/hooks/jira/use-adf-media";
import { useIssueMedia, type JiraAttachment } from "@/hooks/jira/use-issue-media";
import { usePendingUploads } from "@/hooks/jira/use-pending-uploads";
import { blobDataUrl, imageSize } from "@/lib/image-size";
import type { AdfNode } from "@/lib/jira/adf";
import { imageMediaSingle, mediaIdIndex, pastedFileName } from "@/lib/jira/adf-media";
import type { EditorFileHandler } from "@/lib/jira/adf-uploads";
import { fileMediaInline } from "@/lib/jira/attachment-link";
import { jiraKeys } from "@/lib/jira/keys";
import { pendingMediaId } from "@/lib/jira/pending-media";
import type { RenderedDoc } from "@/lib/jira/rendered-issue";

export type EditorMediaSource = { doc: unknown; rendered: RenderedDoc | undefined };

export type EditorMedia = EditorFileHandler & {
  attachments: readonly JiraAttachment[];
  known: ReadonlyMap<string, JiraAttachment>;
};

export const EditorMediaContext = createContext<EditorMedia | null>(null);

export const useEditorMediaContext = () => use(EditorMediaContext);

const NO_ATTACHMENTS: readonly JiraAttachment[] = [];
const anyFile = () => true;

export function useEditorMedia(source?: EditorMediaSource): EditorMedia {
  const queryClient = useQueryClient();
  const issueMedia = useIssueMedia();
  const saved = useAdfMedia(source?.doc, source?.rendered);
  const uploads = usePendingUploads((state) => state.uploads);
  const hold = usePendingUploads((state) => state.add);
  const issueAttachments = issueMedia?.attachments ?? NO_ATTACHMENTS;

  return useMemo(() => {
    const pending = Object.entries(uploads);
    const sent = pending.flatMap(([, upload]) => (upload.uploaded ? [upload.uploaded.attachment] : []));
    const attachments = [...issueAttachments, ...sent.filter((entry) => !issueAttachments.some((attachment) => attachment.id === entry.id))];
    const known = new Map(saved ? mediaIdIndex(source?.doc, saved.matches) : undefined);
    for (const attachment of attachments) {
      const mediaId = queryClient.getQueryData<string>(jiraKeys.attachmentMediaId(attachment.id));
      if (mediaId) known.set(mediaId, attachment);
    }
    for (const [id, upload] of pending) known.set(id, upload.attachment);
    const add = async (file: File): Promise<AdfNode> => {
      const id = pendingMediaId();
      if (!file.type.startsWith("image/")) {
        hold(id, file);
        return fileMediaInline(id, file.name);
      }
      const named = new File([file], pastedFileName(file.name, new Date()), { type: file.type });
      const [size, preview] = await Promise.all([imageSize(named), blobDataUrl(named).catch(() => undefined)]);
      if (preview) {
        queryClient.setQueryDefaults(jiraKeys.attachment("content", id), { gcTime: Infinity });
        queryClient.setQueryData(jiraKeys.attachment("content", id), preview);
      }
      hold(id, named);
      return imageMediaSingle(id, named.name, size);
    };
    return { attachments, known, accepts: anyFile, add };
  }, [issueAttachments, uploads, hold, saved, source?.doc, queryClient]);
}
