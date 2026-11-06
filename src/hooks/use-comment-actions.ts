import { useCommentPermissions } from "@/hooks/jira/use-comment-permissions";
import { copyToClipboard } from "@/lib/clipboard";
import { commentActions } from "@/lib/jira/comment-permissions";
import { commentLink, editedNote, type IssueComment } from "@/lib/jira/comment-thread";
import { useJiraMyself, useJiraSite, type JiraIssueDetail } from "@/lib/jira/queries";

export function useCommentActions(issue: JiraIssueDetail) {
  const permissions = useCommentPermissions(issue.key);
  const myself = useJiraMyself();
  const site = useJiraSite();
  const siteUrl = site.data?.siteUrl;
  const myAccountId = myself.data?.accountId;
  const projectTypeKey = issue.fields.project.projectTypeKey;

  return {
    allowedFor: (comment: IssueComment) => commentActions(permissions, comment.author?.accountId, myAccountId, projectTypeKey),
    copyLink: (comment: IssueComment) => {
      if (siteUrl) void copyToClipboard(commentLink(siteUrl, issue.key, comment.id), "Link kopiert");
    },
    editedNote,
  };
}
