import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { PencilLineIcon, ReplyIcon } from "lucide-react";
import { AdfContent } from "@/components/adf-content";
import { JiraUserLabel } from "@/components/jira-user-avatar";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/lib/ease";
import type { CommentThread, IssueComment } from "@/lib/jira/comment-thread";

export type CommentEntryView = {
  menu: ReactNode;
  editedNote?: string;
  editor: ReactNode;
  onResumeEdit?: () => void;
  highlighted?: boolean;
};

function CommentEntry({
  comment,
  view,
  replyLabel,
  onReply,
}: {
  comment: IssueComment;
  view: CommentEntryView;
  replyLabel?: string;
  onReply?: (comment: IssueComment) => void;
}) {
  const editing = !!view.editor;
  return (
    <article data-comment-id={comment.id} className="group/comment relative isolate flex flex-col gap-2">
      <AnimatePresence>
        {view.highlighted && (
          <motion.div
            key="highlight"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4, ease: EASE_OUT } }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="pointer-events-none absolute -inset-x-2 -inset-y-1.5 -z-10 rounded-lg bg-primary/12"
          />
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2 text-sm">
        <JiraUserLabel user={comment.author} />
        <span className="text-xs text-muted-foreground" title={new Date(comment.created).toLocaleString("de-DE")}>
          {formatDistanceToNowStrict(new Date(comment.created), { locale: de, addSuffix: true })}
        </span>
        {view.editedNote && (
          <Tooltip content={view.editedNote}>
            <span tabIndex={0} className="rounded-sm text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              bearbeitet
            </span>
          </Tooltip>
        )}
        {view.onResumeEdit && !editing && (
          <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={view.onResumeEdit}>
            <PencilLineIcon />
            Entwurf
          </Button>
        )}
        {!editing && <div className="ml-auto">{view.menu}</div>}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div key="editor" exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }} className="pl-8">
            {view.editor}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="flex flex-col gap-2"
          >
            <AdfContent doc={comment.body} className="pl-8" />
            {onReply && replyLabel && (
              <Button type="button" variant="ghost" size="xs" className="ml-6 self-start text-muted-foreground" onClick={() => onReply(comment)}>
                <ReplyIcon />
                {replyLabel}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

export function CommentThreadView({
  thread,
  viewFor,
  replyLabel,
  onReply,
  replyBox,
}: {
  thread: CommentThread;
  viewFor: (comment: IssueComment) => CommentEntryView;
  replyLabel?: string;
  onReply?: (comment: IssueComment) => void;
  replyBox?: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-3">
      <CommentEntry comment={thread.root} view={viewFor(thread.root)} replyLabel={replyLabel} onReply={onReply} />
      {thread.replies.length > 0 && (
        <ol className="ml-8 flex flex-col gap-4 border-l border-border pl-4">
          <AnimatePresence initial={false}>
            {thread.replies.map((reply) => (
              <motion.li
                key={reply.id}
                layout={reduce ? false : "position"}
                initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
              >
                <CommentEntry comment={reply} view={viewFor(reply)} replyLabel={replyLabel} onReply={onReply} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
      <div className="ml-8 pl-4">
        <AnimatePresence initial={false}>{replyBox}</AnimatePresence>
      </div>
    </div>
  );
}
