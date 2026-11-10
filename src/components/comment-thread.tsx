import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { ReplyIcon } from "lucide-react";
import { AdfContent } from "@/components/adf-content";
import { JiraUserLabel } from "@/components/jira-user-avatar";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/lib/ease";
import type { CommentThread, IssueComment } from "@/lib/jira/comment-thread";

function CommentEntry({
  comment,
  replyLabel,
  onReply,
  headerAction,
}: {
  comment: IssueComment;
  replyLabel?: string;
  onReply?: (comment: IssueComment) => void;
  headerAction?: (comment: IssueComment) => ReactNode;
}) {
  return (
    <article className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 [overflow-wrap:anywhere]">
          <JiraUserLabel user={comment.author} />
          <span className="text-xs text-muted-foreground" title={new Date(comment.created).toLocaleString("de-DE")}>
            {formatDistanceToNowStrict(new Date(comment.created), { locale: de, addSuffix: true })}
          </span>
        </div>
        {headerAction?.(comment)}
      </div>
      <AdfContent doc={comment.body} className="pl-8" />
      {onReply && replyLabel && (
        <Button type="button" variant="ghost" size="xs" className="ml-6 self-start text-muted-foreground" onClick={() => onReply(comment)}>
          <ReplyIcon />
          {replyLabel}
        </Button>
      )}
    </article>
  );
}

export function CommentThreadView({
  thread,
  replyLabel,
  onReply,
  headerAction,
  replyBox,
}: {
  thread: CommentThread;
  replyLabel?: string;
  onReply?: (comment: IssueComment) => void;
  headerAction?: (comment: IssueComment) => ReactNode;
  replyBox?: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-3">
      <CommentEntry comment={thread.root} replyLabel={replyLabel} onReply={onReply} headerAction={headerAction} />
      {thread.replies.length > 0 && (
        <ol className="ml-8 flex flex-col gap-4 border-l border-border pl-4">
          <AnimatePresence initial={false}>
            {thread.replies.map((reply) => (
              <motion.li
                key={reply.id}
                layout={!reduce}
                initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
              >
                <CommentEntry comment={reply} replyLabel={replyLabel} onReply={onReply} headerAction={headerAction} />
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
