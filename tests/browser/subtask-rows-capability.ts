import type { SubtaskRowsCapability } from "@/lib/jira/subtask-rows-capability";

declare global {
  interface Window {
    __qaSubtaskRows?: () => boolean;
  }
}

export const subtaskRowsAllowed: SubtaskRowsCapability = (scope, siteUrl) =>
  window.location.protocol === "http:" &&
  window.location.hostname === "127.0.0.1" &&
  scope.cloudId === "qa-cloud" &&
  scope.accountId === "qa-user" &&
  siteUrl === "https://example.atlassian.net" &&
  window.__qaSubtaskRows?.() === true;
