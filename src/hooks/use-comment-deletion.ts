import { useState } from "react";
import { toast } from "sonner";
import { useJiraDeleteComment } from "@/hooks/jira/use-issue-mutations";
import { useWorkspace } from "@/hooks/use-workspace";
import { deleteReplyHint, repliesKeptOnDelete, type CommentThread, type IssueComment } from "@/lib/jira/comment-thread";
import { setEditDraft } from "@/lib/workspace";

type DeleteTarget = { commentId: string; replyCount: number };

export function useCommentDeletion(issueKey: string, onDeleted: (commentId: string) => void) {
  const mutation = useJiraDeleteComment(issueKey);
  const { update } = useWorkspace();
  const [target, setTarget] = useState<DeleteTarget | null>(null);

  const confirm = async () => {
    if (!target || mutation.isPending) return;
    const { commentId } = target;
    try {
      await mutation.mutateAsync(commentId);
      update((current) => setEditDraft(current, issueKey, commentId, undefined));
      onDeleted(commentId);
      toast.success("Kommentar gelöscht");
    } catch (error) {
      toast.error("Kommentar konnte nicht gelöscht werden", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      mutation.reset();
      setTarget(null);
    }
  };

  return {
    request: (thread: CommentThread, comment: IssueComment) => {
      if (!mutation.isPending) setTarget({ commentId: comment.id, replyCount: repliesKeptOnDelete(thread, comment) });
    },
    dialog: {
      open: !!target,
      onOpenChange: (open: boolean) => {
        if (!open && !mutation.isPending) setTarget(null);
      },
      replyHint: target ? deleteReplyHint(target.replyCount) : undefined,
      pending: mutation.isPending,
      onConfirm: () => void confirm(),
    },
  };
}
