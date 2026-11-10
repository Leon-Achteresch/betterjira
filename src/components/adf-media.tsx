import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FileIcon } from "lucide-react";
import type { AdfMediaRender } from "@/hooks/jira/use-adf-media";
import type { JiraAttachment } from "@/hooks/jira/use-issue-media";
import { useJiraAttachmentImage } from "@/hooks/jira/use-issue-mutations";
import { useNearViewport } from "@/hooks/use-near-viewport";
import { attachmentName } from "@/lib/attachment-filter";
import { EASE_OUT, SPRING_PRESS } from "@/lib/ease";
import { fileSize } from "@/lib/file-size";
import type { AdfNode } from "@/lib/jira/adf";
import { isImageAttachment, mediaAltText, mediaSingleBox, mediaThumbnailBox, type MediaBox } from "@/lib/jira/adf-media";
import { cn } from "@/lib/utils";

const NEAR_VIEWPORT_PX = 400;
const PULSE = "block animate-pulse bg-muted";

type Open = (attachment: JiraAttachment) => void;
type ImageProps = { attachment: JiraAttachment; box: MediaBox; variant: "content" | "thumbnail"; onOpen: Open };

const stop = (event: MouseEvent | KeyboardEvent) => {
  event.stopPropagation();
  event.preventDefault();
};

const press = (onPress: () => void) => ({
  role: "button" as const,
  tabIndex: 0,
  onClick: (event: MouseEvent) => {
    stop(event);
    onPress();
  },
  onKeyDown: (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    stop(event);
    onPress();
  },
});

const boxStyle = (box: MediaBox) => ({ width: box.width, height: box.height, aspectRatio: box.aspectRatio, maxWidth: "100%" });

function PendingSingle({ box }: { box: MediaBox }) {
  return <span data-adf-media="pending" data-adf-pending="single" aria-hidden onClick={stop} className={cn(PULSE, "rounded-xl")} style={boxStyle(box)} />;
}

function PendingChip() {
  return (
    <span
      data-adf-media="pending"
      data-adf-pending="chip"
      onClick={stop}
      aria-hidden
      className="inline-block h-8 w-40 max-w-full animate-pulse rounded-xl bg-muted align-middle"
    />
  );
}

function MissingChip({ name }: { name?: string }) {
  return (
    <span
      data-adf-media="missing"
      onClick={stop}
      className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-xl border border-dashed px-2.5 py-1 align-middle text-xs text-muted-foreground"
    >
      <FileIcon className="size-4 shrink-0" aria-hidden />
      <span className="shrink-0">Anhang nicht verfügbar</span>
      {name && <span className="truncate font-medium text-foreground">{name}</span>}
    </span>
  );
}

function FileChip({ attachment, onOpen }: { attachment: JiraAttachment; onOpen: Open }) {
  const reduce = useReducedMotion();
  const name = attachmentName(attachment.filename);
  return (
    <motion.span
      {...press(() => onOpen(attachment))}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={SPRING_PRESS}
      data-adf-media="file"
      data-attachment-id={attachment.id}
      aria-label={`${name} öffnen`}
      title={name}
      className="inline-flex min-h-8 max-w-full cursor-pointer items-center gap-2 rounded-xl border bg-background px-2.5 py-1 align-middle text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate font-medium">{name}</span>
      <span className="shrink-0 text-muted-foreground tabular-nums">{fileSize(attachment.size)}</span>
    </motion.span>
  );
}

function LoadedImage({ attachment, box, variant, onOpen }: ImageProps) {
  const image = useJiraAttachmentImage(attachment.id, variant);
  const [broken, setBroken] = useState(false);
  const reduce = useReducedMotion();
  if (image.error || broken) return <FileChip attachment={attachment} onOpen={onOpen} />;
  const name = attachmentName(attachment.filename);
  const sized = box.aspectRatio !== undefined || variant === "thumbnail";
  const free = !sized && !!image.data;
  return (
    <motion.span
      {...press(() => onOpen(attachment))}
      whileTap={reduce ? undefined : { scale: 0.99 }}
      transition={SPRING_PRESS}
      data-adf-media="image"
      data-attachment-id={attachment.id}
      data-state={image.data ? "loaded" : "loading"}
      aria-label={`${name} groß anzeigen`}
      title={name}
      className={cn(
        "block cursor-zoom-in overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        free && !box.width && "w-fit",
      )}
      style={free ? { width: box.width, maxWidth: "100%" } : boxStyle(box)}
    >
      {image.data ? (
        <motion.img
          src={image.data}
          alt={name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          onError={() => setBroken(true)}
          className={
            sized
              ? cn("size-full", variant === "thumbnail" ? "object-cover" : "object-contain")
              : box.width
                ? "block h-auto w-full"
                : "block h-auto max-w-full"
          }
        />
      ) : (
        <span aria-hidden className={cn(PULSE, "size-full")} />
      )}
    </motion.span>
  );
}

function MediaImage(props: ImageProps) {
  const [ref, near] = useNearViewport<HTMLSpanElement>(NEAR_VIEWPORT_PX);
  if (near) return <LoadedImage {...props} />;
  return (
    <span
      ref={ref}
      data-adf-media="image"
      data-attachment-id={props.attachment.id}
      data-state="idle"
      onClick={stop}
      className="block overflow-hidden rounded-xl"
      style={boxStyle(props.box)}
    >
      <span aria-hidden className={cn(PULSE, "size-full")} />
    </span>
  );
}

export function AdfMediaSingle({ node, media }: { node: AdfNode; media: AdfMediaRender }) {
  const child = node.content?.find((entry) => entry.type === "media");
  const box = mediaSingleBox(node.attrs, child?.attrs);
  const attachment = child && media.matches.get(child);
  const unmatchable = !child || child.attrs?.type !== "file";
  return (
    <div data-adf-media-single className="min-w-0">
      {unmatchable ? (
        <MissingChip name={child && mediaAltText(child)} />
      ) : media.pending ? (
        <PendingSingle box={box} />
      ) : !child || !attachment ? (
        <MissingChip name={child && mediaAltText(child)} />
      ) : isImageAttachment(attachment) ? (
        <MediaImage attachment={attachment} box={box} variant="content" onOpen={media.open} />
      ) : (
        <FileChip attachment={attachment} onOpen={media.open} />
      )}
    </div>
  );
}

export function AdfMediaGroup({ node, media }: { node: AdfNode; media: AdfMediaRender }) {
  const children = (node.content ?? []).filter((entry) => entry.type === "media");
  return (
    <div data-adf-media-group className="flex flex-wrap items-start gap-2">
      {media.pending ? (
        <PendingChip />
      ) : (
        children.map((child, index) => {
          const attachment = media.matches.get(child);
          if (!attachment) return <MissingChip key={index} name={mediaAltText(child)} />;
          return isImageAttachment(attachment) ? (
            <MediaImage key={index} attachment={attachment} box={mediaThumbnailBox(child.attrs)} variant="thumbnail" onOpen={media.open} />
          ) : (
            <FileChip key={index} attachment={attachment} onOpen={media.open} />
          );
        })
      )}
    </div>
  );
}

export function AdfMediaInline({ node, media }: { node: AdfNode; media: AdfMediaRender }) {
  if (media.pending) return <PendingChip />;
  const attachment = media.matches.get(node);
  return attachment ? <FileChip attachment={attachment} onOpen={media.open} /> : <MissingChip name={mediaAltText(node)} />;
}
