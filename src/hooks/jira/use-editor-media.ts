import { createContext, use, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import { useAdfMedia } from "@/hooks/jira/use-adf-media";
import { useIssueMedia, type JiraAttachment } from "@/hooks/jira/use-issue-media";
import { blobDataUrl, imageSize } from "@/lib/image-size";
import type { AdfNode } from "@/lib/jira/adf";
import { imageMediaSingle, isImageAttachment, mediaIdIndex, pastedFileName } from "@/lib/jira/adf-media";
import type { EditorFileHandler } from "@/lib/jira/adf-uploads";
import { uploadEmbeddedFile } from "@/lib/jira/issue";
import { jiraKeys } from "@/lib/jira/keys";
import { invalidateIssueChange } from "@/lib/jira/mutation-cache";
import type { RenderedDoc } from "@/lib/jira/rendered-issue";

export type EditorMediaSource = { doc: unknown; rendered: RenderedDoc | undefined };

export type EditorMedia = EditorFileHandler & {
  attachments: readonly JiraAttachment[];
  known: ReadonlyMap<string, JiraAttachment>;
};

export const EditorMediaContext = createContext<EditorMedia | null>(null);

export const useEditorMediaContext = () => use(EditorMediaContext);

const NO_ATTACHMENTS: readonly JiraAttachment[] = [];
const isImageFile = (file: File) => file.type.startsWith("image/");

export function useEditorMedia(issueKey: string, source?: EditorMediaSource): EditorMedia {
  const queryClient = useQueryClient();
  const issueMedia = useIssueMedia();
  const saved = useAdfMedia(source?.doc, source?.rendered);
  const [uploaded, setUploaded] = useState<readonly JiraAttachment[]>(NO_ATTACHMENTS);
  const issueAttachments = issueMedia?.attachments ?? NO_ATTACHMENTS;

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const named = new File([file], pastedFileName(file.name, new Date()), { type: file.type });
      const [result, size] = await Promise.all([Effect.runPromise(uploadEmbeddedFile(issueKey, named)), imageSize(named)]);
      return { ...result, size, preview: await blobDataUrl(named).catch(() => undefined) };
    },
    onSuccess: ({ attachment, mediaId, preview }) => {
      queryClient.setQueryData(jiraKeys.attachmentMediaId(attachment.id), mediaId);
      if (preview) queryClient.setQueryData(jiraKeys.attachment("content", attachment.id), preview);
      setUploaded((current) => [...current, attachment]);
      invalidateIssueChange(queryClient, issueKey, false);
    },
    onError: (error, file) => {
      toast.error(`${file.name} konnte nicht eingefügt werden`, { description: error instanceof Error ? error.message : String(error) });
    },
  });
  const { mutateAsync } = upload;

  return useMemo(() => {
    const attachments = [...issueAttachments, ...uploaded.filter((entry) => !issueAttachments.some((attachment) => attachment.id === entry.id))];
    const known = new Map(saved ? mediaIdIndex(source?.doc, saved.matches) : undefined);
    for (const attachment of attachments) {
      const mediaId = queryClient.getQueryData<string>(jiraKeys.attachmentMediaId(attachment.id));
      if (mediaId) known.set(mediaId, attachment);
    }
    const add = async (file: File): Promise<AdfNode | null> => {
      const { attachment, mediaId, size } = await mutateAsync(file);
      return isImageAttachment(attachment) ? imageMediaSingle(mediaId, attachment.filename, size) : null;
    };
    return { attachments, known, accepts: isImageFile, add };
  }, [issueAttachments, uploaded, saved, source?.doc, queryClient, mutateAsync]);
}
