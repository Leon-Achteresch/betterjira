import type { WorklogEstimateCapability } from "@/lib/jira/worklog-estimate-capability";

declare global {
  interface Window {
    __qaWorklogEstimate?: () => boolean;
  }
}

export const worklogEstimateAllowed: WorklogEstimateCapability = (
  scope,
  siteUrl,
) =>
  window.location.protocol === "http:" &&
  window.location.hostname === "127.0.0.1" &&
  scope.cloudId === "qa-cloud" &&
  ["qa-user", "qa-n15-other"].includes(scope.accountId) &&
  siteUrl === "https://example.atlassian.net" &&
  window.__qaWorklogEstimate?.() === true;
