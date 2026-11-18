import type { QueryClient } from "@tanstack/react-query";
import type { JiraIssueDetail } from "./queries";
import type { JiraQueryScope } from "./query-scope";
import { jiraQueryScopeMatches } from "./query-scope";
import { jiraKeys } from "./keys";
import type { AttachmentDeleteResult } from "./attachment-deletion";

export const acknowledgeAttachmentDeletion = (client: QueryClient, issueKey: string, scope: JiraQueryScope, result: AttachmentDeleteResult) => {
  if (result.status !== "deleted") return;
  client.setQueryData<JiraIssueDetail>(jiraKeys.issueDetail(issueKey, scope), (current) => current && ({
    ...current, fields: { ...current.fields, attachment: current.fields.attachment?.filter((entry) => entry.id !== result.attachment.id) },
  }));
  if (jiraQueryScopeMatches(client, scope)) {
    for (const variant of ["content", "thumbnail"]) client.removeQueries({ queryKey: jiraKeys.attachment(variant, result.attachment.id), exact: true });
  }
};
