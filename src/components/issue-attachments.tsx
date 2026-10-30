import { useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FileIcon, PaperclipIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useJiraAttachmentImage, useJiraUploadAttachments } from "@/lib/jira/issue";
import { type JiraIssueDetail, useJiraSite } from "@/lib/jira/queries";

type Attachment = NonNullable<JiraIssueDetail["fields"]["attachment"]>[number];

const fileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

function Thumbnail({ attachment }: { attachment: Attachment }) {
  const image = useJiraAttachmentImage(attachment.id, "thumbnail");
  if (image.data) return <img src={image.data} alt="" className="size-full object-cover" />;
  if (image.isPending) return <Skeleton className="size-full rounded-none" />;
  return <FileIcon className="size-6 text-muted-foreground" />;
}

function Preview({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const image = useJiraAttachmentImage(attachment.id, "content");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-5xl">
        <DialogTitle className="truncate pr-8">{attachment.filename}</DialogTitle>
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto">
          {image.data ? (
            <img src={image.data} alt={attachment.filename} className="max-h-[75vh] object-contain" />
          ) : image.error ? (
            <p role="alert" className="text-sm text-destructive">
              {image.error.message}
            </p>
          ) : (
            <Spinner />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function IssueAttachments({ issueKey, attachments }: { issueKey: string; attachments: readonly Attachment[] }) {
  const site = useJiraSite();
  const upload = useJiraUploadAttachments(issueKey);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Attachment>();

  const open = (attachment: Attachment) => {
    if (attachment.mimeType.startsWith("image/")) return setPreview(attachment);
    if (site.data) void openUrl(`${site.data.siteUrl}/rest/api/3/attachment/content/${attachment.id}`);
  };

  return (
    <div className="flex flex-col gap-3">
      {attachments.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <button
                type="button"
                onClick={() => open(attachment)}
                title={attachment.filename}
                className="flex w-full flex-col overflow-hidden rounded-lg border text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid h-24 place-items-center overflow-hidden bg-muted">
                  {attachment.mimeType.startsWith("image/") ? (
                    <Thumbnail attachment={attachment} />
                  ) : (
                    <FileIcon className="size-6 text-muted-foreground" />
                  )}
                </span>
                <span className="flex flex-col px-2 py-1.5">
                  <span className="truncate text-xs font-medium">{attachment.filename}</span>
                  <span className="text-[11px] text-muted-foreground">{fileSize(attachment.size)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            if (files.length > 0) upload.mutate(files);
          }}
        />
        <Button variant="outline" size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}>
          {upload.isPending ? <Spinner /> : <PaperclipIcon />}
          Datei anhängen
        </Button>
        {upload.error && (
          <p role="alert" className="text-sm text-destructive">
            {upload.error.message}
          </p>
        )}
      </div>
      {preview && <Preview attachment={preview} onClose={() => setPreview(undefined)} />}
    </div>
  );
}
