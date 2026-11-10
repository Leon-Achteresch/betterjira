import { useCommentPermissions } from "@/hooks/jira/use-comment-permissions";
import { COMMENT_LINK_UNAVAILABLE, useCommentLink } from "@/hooks/jira/use-comment-link";
import { commentActions } from "@/lib/jira/comment-permissions";
import { editedNote, type IssueComment } from "@/lib/jira/comment-thread";
import { useJiraMyself, type JiraIssueDetail } from "@/lib/jira/queries";

export function useCommentActions(issue: JiraIssueDetail) {
  const permissions = useCommentPermissions(issue.key);
  const myself = useJiraMyself();
  const link = useCommentLink(issue.key);
  const myAccountId = myself.data?.accountId;
  const projectTypeKey = issue.fields.project.projectTypeKey;

  return {
    allowedFor: (comment: IssueComment) => commentActions(permissions, comment.author?.accountId, myAccountId, projectTypeKey),
    linkFor: (comment: IssueComment) => ({
      disabledReason: link.available(comment.id) ? undefined : COMMENT_LINK_UNAVAILABLE,
      onSelect: () => void link.copy(comment.id),
    }),
    editedNote,
  };
}
