import type { TableFieldApplyCapability } from "@/lib/jira/table-field-apply-capability";

declare global {
  interface Window {
    __N02_NATIVE_FIXTURE__?: boolean;
  }
}

export const tableFieldApplyAllowed: TableFieldApplyCapability = (scope, siteUrl) =>
  window.location.protocol === "tauri:" &&
  window.location.hostname === "localhost" &&
  window.__N02_NATIVE_FIXTURE__ === true &&
  /^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(window.__C1_JIRA_ORIGIN__) &&
  scope.cloudId === "mock-cloud" &&
  scope.accountId === "mock-user-000" &&
  siteUrl === "https://mock-jira.atlassian.net";
