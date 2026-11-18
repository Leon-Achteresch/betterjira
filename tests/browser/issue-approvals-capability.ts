import type { IssueApprovalsCapability } from "@/lib/jira/issue-approvals-capability";

declare global {
  interface Window {
    __qaIssueApprovals?: () => boolean;
  }
}

export const issueApprovalsAllowed: IssueApprovalsCapability = (
  scope,
  siteUrl,
) =>
  window.location.protocol === "http:" &&
  window.location.hostname === "127.0.0.1" &&
  scope.cloudId === "qa-cloud" &&
  ["qa-user", "qa-n11-other"].includes(scope.accountId) &&
  siteUrl === "https://example.atlassian.net" &&
  window.__qaIssueApprovals?.() === true;
