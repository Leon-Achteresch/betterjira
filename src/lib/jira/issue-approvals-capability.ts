import type { JiraQueryScope } from "./query-scope";

export type IssueApprovalsCapability = (
  scope: JiraQueryScope,
  siteUrl: string,
) => boolean;

export const issueApprovalsAllowed: IssueApprovalsCapability = () => false;
