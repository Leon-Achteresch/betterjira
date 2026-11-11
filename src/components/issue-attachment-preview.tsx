import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AttachmentTile } from "@/components/issue-attachment-tile";
import { useIssueMedia } from "@/hooks/jira/use-issue-media";
import { attachmentPreview } from "@/lib/attachment-preview";
import { EASE_OUT, FADE_OUT, MOTION_DURATION, SPRING_LAYOUT } from "@/lib/ease";

export function IssueAttachmentPreview() {
  const media = useIssueMedia();
  const reduce = useReducedMotion();
  const attachments = media?.attachments;
  const shown = useMemo(() => attachmentPreview(attachments ?? []).shown, [attachments]);
  if (!media) return null;
  return (
    <ul aria-label="Anhänge am Ticket" className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
      <AnimatePresence>
        {shown.map((attachment, index) => (
          <motion.li
            key={attachment.id}
            layout={!reduce}
            initial={{ opacity: 0, y: reduce ? 0 : 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: MOTION_DURATION.enter, ease: EASE_OUT, delay: index * MOTION_DURATION.stagger } }}
            exit={{ opacity: 0, transition: FADE_OUT }}
            transition={{ layout: SPRING_LAYOUT }}
            className="min-w-0"
          >
            <AttachmentTile attachment={attachment} layout="row" onOpen={media.open} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
