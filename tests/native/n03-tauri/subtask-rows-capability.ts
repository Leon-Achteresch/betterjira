import type { SubtaskRowsCapability } from "@/lib/jira/subtask-rows-capability";

declare global {
  interface Window {
    __N03_NATIVE_FIXTURE__?: boolean;
  }
}

export const subtaskRowsAllowed: SubtaskRowsCapability = (scope, siteUrl) =>
  window.location.protocol === "tauri:" &&
  window.location.hostname === "localhost" &&
  window.__N03_NATIVE_FIXTURE__ === true &&
  /^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(window.__C1_JIRA_ORIGIN__) &&
  scope.cloudId === "mock-cloud" &&
  scope.accountId === "mock-user-000" &&
  siteUrl === "https://mock-jira.atlassian.net";
