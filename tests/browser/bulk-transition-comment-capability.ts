import type { BulkTransitionCommentCapability } from "@/lib/jira/bulk-transition-comment-capability";

declare global {
  interface Window {
    __qaBulkTransitionComment?: () => boolean;
  }
}

export const bulkTransitionCommentAllowed: BulkTransitionCommentCapability = (scope, siteUrl) =>
  window.location.protocol === "http:"
  && window.location.hostname === "127.0.0.1"
  && scope.cloudId === "qa-cloud" && scope.accountId === "qa-user"
  && siteUrl === "https://example.atlassian.net"
  && window.__qaBulkTransitionComment?.() === true;
