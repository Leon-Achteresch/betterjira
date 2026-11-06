import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useIssueCommentList } from "@/hooks/jira/use-issue-comment-list";
import { useJiraUpdateComment } from "@/hooks/jira/use-issue-mutations";
import { useWorkspace } from "@/hooks/use-workspace";
import type { AdfNode } from "@/lib/jira/adf";
import { canSaveEdit, editBaseline, editBlockReason, editDraftToKeep, editErrorFor, saveFailureNotice } from "@/lib/jira/comment-edit";
import { editPayload, type IssueComment } from "@/lib/jira/comment-thread";
import { clearSubmittedEditDraft, editDraftOf, pruneEditDrafts, setEditDraft } from "@/lib/workspace";

type OpenEdit = { commentId: string; value: AdfNode; attempt: number };

export function useCommentEdits(issueKey: string) {
  const list = useIssueCommentList(issueKey);
  const mutation = useJiraUpdateComment(issueKey);
  const { workspace, update, ready } = useWorkspace();
  const [open, setOpen] = useState<OpenEdit | null>(null);
  const submitting = useRef(false);
  const openCommentId = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    openCommentId.current = open?.commentId;
  });
  const comments = list.data;
  const target = open ? comments?.find((comment) => comment.id === open.commentId) : undefined;
  const baseline = target ? editBaseline(target.body) : undefined;
  const loadedIds = comments?.map((comment) => comment.id).join(",");

  useEffect(() => {
    if (loadedIds === undefined) return;
    update((current) => pruneEditDrafts(current, issueKey, loadedIds ? loadedIds.split(",") : []));
  }, [issueKey, loadedIds, update]);

  const keepDraft = (commentId: string, value: AdfNode | undefined, base: AdfNode | undefined) =>
    update((current) => setEditDraft(current, issueKey, commentId, editDraftToKeep(value, base)));

  const start = (comment: IssueComment) => {
    const base = editBaseline(comment.body);
    if (!ready || !base) return;
    if (!mutation.isPending) mutation.reset();
    const draft = editDraftOf(workspace, issueKey, comment.id);
    setOpen((current) => ({ commentId: comment.id, value: draft ?? base, attempt: (current?.attempt ?? 0) + 1 }));
  };

  const setValue = (doc: AdfNode) => {
    if (!open) return;
    const { commentId } = open;
    setOpen((current) => (current?.commentId === commentId ? { ...current, value: doc } : current));
    keepDraft(commentId, doc, baseline);
  };

  const close = () => {
    if (open) keepDraft(open.commentId, open.value, baseline);
    setOpen(null);
  };

  const save = async () => {
    if (!open || !target || !ready || submitting.current || !canSaveEdit(open.value, baseline, mutation.isPending)) return;
    const { commentId, value: submitted } = open;
    submitting.current = true;
    try {
      await mutation.mutateAsync({ id: commentId, payload: editPayload(submitted, target) });
      update((current) => clearSubmittedEditDraft(current, issueKey, commentId, submitted));
      setOpen((current) => (current?.commentId === commentId ? null : current));
      toast.success("Kommentar gespeichert");
    } catch (error) {
      if (saveFailureNotice(openCommentId.current, commentId) === "inline") return;
      mutation.reset();
      toast.error("Kommentar konnte nicht gespeichert werden", {
        description: `${error instanceof Error ? error.message : String(error)} Dein Entwurf bleibt erhalten.`,
      });
    } finally {
      submitting.current = false;
    }
  };

  const discardChanges = () => {
    if (!open || !baseline) return;
    const { commentId } = open;
    setOpen((current) => (current?.commentId === commentId ? { ...current, value: baseline } : current));
    update((current) => setEditDraft(current, issueKey, commentId, undefined));
  };

  return {
    ready,
    value: open?.value,
    boxKey: open ? `${open.commentId}-${open.attempt}` : undefined,
    isOpenFor: (comment: IssueComment) => open?.commentId === comment.id,
    hasDraft: (comment: IssueComment) => !!editDraftOf(workspace, issueKey, comment.id),
    editLabel: (comment: IssueComment) => (editDraftOf(workspace, issueKey, comment.id) ? "Bearbeitung fortsetzen" : "Bearbeiten"),
    blockReason: (comment: IssueComment) => editBlockReason(comment.body),
    start,
    setValue,
    close,
    save,
    discardChanges,
    closeFor: (commentId: string) => setOpen((current) => (current?.commentId === commentId ? null : current)),
    canSave: ready && canSaveEdit(open?.value, baseline, mutation.isPending),
    pending: mutation.isPending,
    error: editErrorFor(open?.commentId, mutation.variables?.id, mutation.error?.message),
  };
}
