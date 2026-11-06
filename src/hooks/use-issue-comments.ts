import { useRef, type FormEvent } from "react";
import { toast } from "sonner";
import type { AdfEditorHandle } from "@/components/adf-editor";
import { useIssueCommentList } from "@/hooks/jira/use-issue-comment-list";
import { useJiraPostComment } from "@/hooks/jira/use-issue-mutations";
import { useCommentComposer } from "@/hooks/use-comment-composer";
import { useWorkspace } from "@/hooks/use-workspace";
import { appendBlocks, hasSendableContent, type AdfNode } from "@/lib/jira/adf";
import { buildThreads } from "@/lib/jira/comment-thread";
import { issueParticipants } from "@/lib/jira/people";
import type { JiraIssueDetail } from "@/lib/jira/queries";
import { clearSubmittedMainDraft, mainDraftOf, setMainDraft } from "@/lib/workspace";

type ListState = "loading" | "error" | "ready";

export function useIssueComments(issue: JiraIssueDetail) {
  const issueKey = issue.key;
  const list = useIssueCommentList(issueKey);
  const post = useJiraPostComment(issueKey);
  const { workspace, update, ready } = useWorkspace();
  const submitting = useRef(false);
  const editorRef = useRef<AdfEditorHandle>(null);
  const templateInserted = useRef(false);
  const draft = mainDraftOf(workspace, issueKey);
  const composer = useCommentComposer(!!draft || post.isPending);
  const comments = list.data ?? [];
  const setDraft = (value: AdfNode | undefined) => update((current) => setMainDraft(current, issueKey, value));
  const listState: ListState = list.data ? "ready" : list.isPending || list.isFetching ? "loading" : list.isError ? "error" : "ready";

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!ready || !draft || !hasSendableContent(draft) || submitting.current || post.isPending) return;
    submitting.current = true;
    const submitted = draft;
    try {
      await post.mutateAsync(submitted);
      update((current) => clearSubmittedMainDraft(current, issueKey, submitted));
      toast.success("Kommentar hinzugefügt");
    } catch {
      return;
    } finally {
      submitting.current = false;
    }
  };

  return {
    draft,
    composer,
    ready,
    editorRef,
    setDraft,
    submit,
    canSend: ready && !!draft && hasSendableContent(draft) && !post.isPending,
    pending: post.isPending,
    error: post.error?.message,
    participants: issueParticipants(issue.fields, comments),
    threads: buildThreads(comments, workspace.newestFirst),
    hasComments: comments.length > 0,
    listState,
    listError: list.error?.message,
    refreshFailed: !!list.data && list.isError && !list.isFetching,
    reload: () => void list.refetch(),
    newestFirst: workspace.newestFirst,
    toggleOrder: () => update((current) => ({ ...current, newestFirst: !current.newestFirst })),
    insertTemplate: (blocks: readonly AdfNode[]) => {
      templateInserted.current = true;
      setDraft(appendBlocks(draft, blocks));
      editorRef.current?.focus();
    },
    onTemplateMenuClose: (event: Event) => {
      if (!templateInserted.current) return;
      templateInserted.current = false;
      event.preventDefault();
      editorRef.current?.focus();
    },
    discard: () => {
      if (!draft) return;
      const discarded = draft;
      setDraft(undefined);
      toast("Entwurf verworfen", {
        action: {
          label: "Rückgängig",
          onClick: () =>
            update((current) => setMainDraft(current, issueKey, appendBlocks(mainDraftOf(current, issueKey), discarded.content ?? []))),
        },
      });
    },
  };
}
