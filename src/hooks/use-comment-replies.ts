import { useRef, useState } from "react";
import { toast } from "sonner";
import { useJiraPostReply } from "@/hooks/jira/use-issue-mutations";
import { useWorkspace } from "@/hooks/use-workspace";
import { hasSendableContent, type AdfNode } from "@/lib/jira/adf";
import { replyPrefill, threadKey, type IssueComment } from "@/lib/jira/comment-thread";
import { useJiraMyself, type JiraIssueDetail } from "@/lib/jira/queries";
import { clearSubmittedReplyDraft, replyDraftOf, setReplyDraft } from "@/lib/workspace";

type OpenReply = { thread: string; prefill?: AdfNode; attempt: number };

export function useCommentReplies(issue: JiraIssueDetail) {
  const issueKey = issue.key;
  const reply = useJiraPostReply(issueKey);
  const myself = useJiraMyself();
  const { workspace, update, ready } = useWorkspace();
  const [open, setOpen] = useState<OpenReply | null>(null);
  const submitting = useRef(false);
  const draft = open ? replyDraftOf(workspace, issueKey, open.thread) : undefined;
  const value = draft ?? open?.prefill;

  const start = (comment: IssueComment, root: IssueComment) => {
    const thread = threadKey(root);
    reply.reset();
    setOpen((current) => ({
      thread,
      prefill: replyDraftOf(workspace, issueKey, thread) ? undefined : replyPrefill(comment.author, myself.data?.accountId),
      attempt: (current?.attempt ?? 0) + 1,
    }));
  };

  const setDraft = (doc: AdfNode) => {
    if (!open) return;
    const { thread } = open;
    setOpen((current) => (current?.thread === thread ? { thread, attempt: current.attempt } : current));
    update((current) => setReplyDraft(current, issueKey, thread, doc));
  };

  const submit = async () => {
    if (!open || !ready || !value || !hasSendableContent(value) || submitting.current || reply.isPending) return;
    const { thread } = open;
    const submitted = value;
    submitting.current = true;
    try {
      const created = await reply.mutateAsync({ body: submitted, threadKey: thread });
      update((current) => clearSubmittedReplyDraft(current, issueKey, thread, submitted));
      setOpen((current) => (current?.thread === thread ? null : current));
      if (created.parentId) toast.success("Antwort hinzugefügt");
      else toast.warning("Jira hat die Antwort als normalen Kommentar angelegt");
    } catch {
      return;
    } finally {
      submitting.current = false;
    }
  };

  return {
    canReply: issue.fields.project.projectTypeKey !== "service_desk",
    ready,
    value,
    setDraft,
    start,
    close: () => setOpen(null),
    submit,
    isOpenFor: (root: IssueComment) => open?.thread === threadKey(root),
    openThread: open?.thread,
    boxKey: open ? `${open.thread}-${open.attempt}` : undefined,
    labelFor: (root: IssueComment) => (replyDraftOf(workspace, issueKey, threadKey(root)) ? "Antwort fortsetzen" : "Antworten"),
    canSend: ready && !!value && hasSendableContent(value) && !reply.isPending,
    pending: reply.isPending,
    error: reply.error?.message,
  };
}
