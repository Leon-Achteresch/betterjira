import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { AttachmentTile } from "@/components/issue-attachment-tile";
import { useIssueMedia } from "@/hooks/jira/use-issue-media";
import { attachmentPreview } from "@/lib/attachment-preview";
import { EASE_OUT, FADE_OUT, MOTION_DURATION, SPRING_LAYOUT } from "@/lib/ease";

const LIST: Variants = { show: { transition: { staggerChildren: MOTION_DURATION.stagger } } };

const ITEM: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: MOTION_DURATION.enter, ease: EASE_OUT } },
};

const ITEM_REDUCED: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: MOTION_DURATION.enter, ease: EASE_OUT } },
};

export function IssueAttachmentPreview() {
  const media = useIssueMedia();
  const reduce = useReducedMotion();
  const attachments = media?.attachments;
  const shown = useMemo(() => attachmentPreview(attachments ?? []).shown, [attachments]);
  if (!media) return null;
  return (
    <motion.ul aria-label="Anhänge am Ticket" variants={LIST} className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
      <AnimatePresence>
        {shown.map((attachment) => (
          <motion.li
            key={attachment.id}
            layout={!reduce}
            variants={reduce ? ITEM_REDUCED : ITEM}
            exit={{ opacity: 0, transition: FADE_OUT }}
            transition={{ layout: SPRING_LAYOUT }}
            className="min-w-0"
          >
            <AttachmentTile attachment={attachment} layout="row" onOpen={media.open} />
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
