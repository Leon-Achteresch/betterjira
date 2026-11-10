import { cva, type VariantProps } from "class-variance-authority";
import { motion, useReducedMotion } from "motion/react";
import { FileIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { JiraAttachment } from "@/hooks/jira/use-issue-media";
import { useJiraAttachmentImage } from "@/hooks/jira/use-issue-mutations";
import { attachmentName } from "@/lib/attachment-filter";
import { SPRING_PRESS } from "@/lib/ease";
import { fileSize } from "@/lib/file-size";
import { isImageAttachment } from "@/lib/jira/adf-media";

const tile = cva(
  "flex w-full overflow-hidden rounded-xl border text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: { layout: { card: "flex-col", row: "min-h-14 items-center gap-3 p-2" } },
    defaultVariants: { layout: "card" },
  },
);

const frame = cva("grid shrink-0 place-items-center overflow-hidden bg-muted", {
  variants: { layout: { card: "h-24", row: "size-10 rounded-lg" } },
  defaultVariants: { layout: "card" },
});

const caption = cva("flex min-w-0 flex-col", {
  variants: { layout: { card: "px-2 py-1.5", row: "gap-0.5" } },
  defaultVariants: { layout: "card" },
});

const icon = cva("text-muted-foreground", {
  variants: { layout: { card: "size-6", row: "size-5" } },
  defaultVariants: { layout: "card" },
});

type Layout = VariantProps<typeof tile>["layout"];

function Thumbnail({ attachment, layout }: { attachment: JiraAttachment; layout: Layout }) {
  const image = useJiraAttachmentImage(attachment.id, "thumbnail");
  if (image.data) return <img src={image.data} alt="" className="size-full object-cover" />;
  if (image.isPending) return <Skeleton className="size-full rounded-none" />;
  return <FileIcon className={icon({ layout })} aria-hidden />;
}

export function AttachmentTile({
  attachment,
  layout,
  onOpen,
}: {
  attachment: JiraAttachment;
  layout?: Layout;
  onOpen: (attachment: JiraAttachment) => void;
}) {
  const reduce = useReducedMotion();
  const name = attachmentName(attachment.filename);
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(attachment)}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={SPRING_PRESS}
      title={name}
      data-attachment-id={attachment.id}
      className={tile({ layout })}
    >
      <span className={frame({ layout })}>
        {isImageAttachment(attachment) ? <Thumbnail attachment={attachment} layout={layout} /> : <FileIcon className={icon({ layout })} aria-hidden />}
      </span>
      <span className={caption({ layout })}>
        <span className="truncate text-xs font-medium">{name}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{fileSize(attachment.size)}</span>
      </span>
    </motion.button>
  );
}
