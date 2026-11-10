import { useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDownUpIcon, FileIcon, PaperclipIcon, SearchXIcon } from "lucide-react";
import { SearchField } from "@/components/motion/search-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAttachmentFilter } from "@/hooks/use-attachment-filter";
import { useJiraAttachmentImage, useJiraUploadAttachments } from "@/hooks/jira/use-issue-mutations";
import { ATTACHMENT_KINDS, type AttachmentKind, attachmentName } from "@/lib/attachment-filter";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { fileSize } from "@/lib/file-size";
import { useAttachmentSort } from "@/hooks/use-attachment-sort";
import { type JiraIssueDetail, useJiraSite } from "@/lib/jira/queries";

type Attachment = NonNullable<JiraIssueDetail["fields"]["attachment"]>[number];

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
        <DialogTitle className="truncate pr-8">{attachmentName(attachment.filename)}</DialogTitle>
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto">
          {image.data ? (
            <img src={image.data} alt={attachmentName(attachment.filename)} className="max-h-[75vh] object-contain" />
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

type FilterBarProps = {
  query: string;
  kind: AttachmentKind;
  shown: number;
  total: number;
  active: boolean;
  onQueryChange: (query: string) => void;
  onKindChange: (kind: AttachmentKind) => void;
  onReset: () => void;
};

const isAttachmentKind = (value: string): value is AttachmentKind => ATTACHMENT_KINDS.some((entry) => entry.value === value);

function AttachmentFilterBar({ query, kind, shown, total, active, onQueryChange, onKindChange, onReset }: FilterBarProps) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={query}
          onChange={onQueryChange}
          label="Anhänge nach Dateiname durchsuchen"
          placeholder="Dateiname"
          className="min-w-0 flex-1 basis-48"
        />
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Dateityp"
          value={kind}
          onValueChange={(value) => isAttachmentKind(value) && onKindChange(value)}
        >
          {ATTACHMENT_KINDS.map((entry) => (
            <ToggleGroupItem key={entry.value} value={entry.value} className="h-8 px-2.5">
              {entry.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <AnimatePresence initial={false}>
        {active && shown > 0 && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: reduce ? 0 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums"
          >
            {shown} von {total} Anhängen
            <Button variant="ghost" size="sm" className="h-8 rounded-xl px-2" onClick={onReset}>
              Filter zurücksetzen
            </Button>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function NoMatches({ total, onReset }: { total: number; onReset: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center"
    >
      <SearchXIcon className="size-5 text-muted-foreground" aria-hidden />
      <p className="text-sm text-balance">
        Keiner der {total} geladenen Anhänge passt zu Suche und Dateityp.
      </p>
      <Button variant="outline" size="sm" className="h-8 rounded-xl" onClick={onReset}>
        Filter zurücksetzen
      </Button>
    </motion.div>
  );
}

export function IssueAttachments({ issueKey, attachments }: { issueKey: string; attachments: readonly Attachment[] }) {
  const site = useJiraSite();
  const upload = useJiraUploadAttachments(issueKey);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Attachment>();
  const filter = useAttachmentFilter(attachments);
  const sort = useAttachmentSort(issueKey, attachments);
  const reduce = useReducedMotion();

  const open = (attachment: Attachment) => {
    if (attachment.mimeType.startsWith("image/")) return setPreview(attachment);
    if (site.data) void openUrl(`${site.data.siteUrl}/rest/api/3/attachment/content/${attachment.id}`);
  };

  return (
    <div className="flex flex-col gap-3">
      {(attachments.length > 1 || filter.active) && (
        <AttachmentFilterBar
          query={filter.query}
          kind={filter.kind}
          shown={filter.shown}
          total={attachments.length}
          active={filter.active}
          onQueryChange={filter.setQuery}
          onKindChange={filter.setKind}
          onReset={filter.reset}
        />
      )}
      {attachments.length > 1 && (
        <div className="flex justify-end">
          <Select value={sort.mode} onValueChange={sort.select}>
            <SelectTrigger aria-label="Anhänge sortieren" className="max-w-full rounded-xl">
              <ArrowDownUpIcon className="text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end" className="rounded-2xl motion-reduce:animate-none!">
              {sort.options.map((option) => (
                <SelectItem key={option.value} value={option.value} className="min-h-8 rounded-xl">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {attachments.length > 0 && (
        <ul aria-label="Anhänge" className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
          {sort.sorted.map((attachment) => (
            <motion.li
              key={attachment.id}
              layout={!reduce}
              transition={SPRING_LAYOUT}
              hidden={!filter.visibleIds.has(attachment.id)}
              className="min-w-0"
            >
              <button
                type="button"
                onClick={() => open(attachment)}
                title={attachmentName(attachment.filename)}
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
                  <span className="truncate text-xs font-medium">{attachmentName(attachment.filename)}</span>
                  <span className="text-[11px] text-muted-foreground">{fileSize(attachment.size)}</span>
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}
      <AnimatePresence initial={false}>
        {attachments.length > 0 && filter.shown === 0 && <NoMatches key="no-matches" total={attachments.length} onReset={filter.reset} />}
      </AnimatePresence>
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
