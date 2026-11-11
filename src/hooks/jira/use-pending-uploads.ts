import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { create } from "zustand";
import type { JiraAttachment } from "@/hooks/jira/use-issue-media";
import { attachmentContentUrl, attachmentLinkNode } from "@/lib/jira/attachment-link";
import { currentSite } from "@/lib/jira/client";
import { attachmentMediaId, optionalAttachmentMediaId, uploadFile } from "@/lib/jira/issue";
import { jiraKeys } from "@/lib/jira/keys";
import { invalidateIssueChange } from "@/lib/jira/mutation-cache";
import { pendingMediaIds, replacePendingMedia } from "@/lib/jira/pending-media";

type Uploaded = { attachment: JiraAttachment; mediaId?: string };
type PendingUpload = { file: File; attachment: JiraAttachment; uploaded?: Uploaded };

type PendingUploadState = {
  uploads: Readonly<Record<string, PendingUpload>>;
  add: (id: string, file: File) => void;
  settle: (id: string, uploaded: Uploaded) => void;
};

export const usePendingUploads = create<PendingUploadState>()((set) => ({
  uploads: {},
  add: (id, file) =>
    set(({ uploads }) => ({
      uploads: { ...uploads, [id]: { file, attachment: { id, filename: file.name, size: file.size, mimeType: file.type, created: new Date().toISOString() } } },
    })),
  settle: (id, uploaded) =>
    set(({ uploads }) => {
      const entry = uploads[id];
      return entry ? { uploads: { ...uploads, [id]: { ...entry, uploaded } } } : { uploads };
    }),
}));

const running = new Map<string, Promise<Uploaded>>();

const upload = async (queryClient: QueryClient, issueKey: string, id: string, { file, uploaded }: PendingUpload): Promise<Uploaded> => {
  const { settle } = usePendingUploads.getState();
  const attachment = uploaded?.attachment ?? (await Effect.runPromise(uploadFile(issueKey, file)));
  if (!uploaded) {
    settle(id, { attachment });
    const preview = queryClient.getQueryData<string>(jiraKeys.attachment("content", id));
    if (preview) queryClient.setQueryData(jiraKeys.attachment("content", attachment.id), preview);
    invalidateIssueChange(queryClient, issueKey, false);
  }
  const mediaId = await Effect.runPromise(file.type.startsWith("image/") ? attachmentMediaId(attachment.id) : optionalAttachmentMediaId(attachment.id));
  if (mediaId) queryClient.setQueryData(jiraKeys.attachmentMediaId(attachment.id), mediaId);
  settle(id, { attachment, mediaId });
  return { attachment, mediaId };
};

const uploadPending = (queryClient: QueryClient, issueKey: string, id: string): Promise<Uploaded> => {
  const entry = usePendingUploads.getState().uploads[id];
  if (!entry) return Promise.reject(new Error("Eine eingefügte Datei ist nicht mehr vorhanden. Entferne sie aus dem Text oder füge sie erneut ein."));
  if (entry.uploaded?.mediaId) return Promise.resolve(entry.uploaded);
  const started = running.get(id) ?? upload(queryClient, issueKey, id, entry).finally(() => running.delete(id));
  running.set(id, started);
  return started;
};

export const resolvePendingMedia = async <A>(queryClient: QueryClient, issueKey: string, input: A): Promise<A> => {
  const ids = pendingMediaIds(input);
  if (ids.length === 0) return input;
  const uploaded = new Map(await Promise.all(ids.map(async (id) => [id, await uploadPending(queryClient, issueKey, id)] as const)));
  const linked = [...uploaded.values()].some((entry) => !entry.mediaId);
  const siteUrl = linked ? ((await Effect.runPromise(currentSite))?.siteUrl ?? "") : "";
  return replacePendingMedia(input, (node, id) => {
    const entry = uploaded.get(id);
    if (!entry) return node;
    return entry.mediaId
      ? { ...node, attrs: { ...node.attrs, id: entry.mediaId } }
      : attachmentLinkNode(entry.attachment.filename, attachmentContentUrl(siteUrl, entry.attachment.id));
  }) as A;
};
