import type { TableFieldApplyCapability } from "@/lib/jira/table-field-apply-capability";

declare global {
  interface Window {
    __qaTableFieldApply?: () => boolean;
  }
}

export const tableFieldApplyAllowed: TableFieldApplyCapability = (scope, siteUrl) =>
  window.location.protocol === "http:" &&
  window.location.hostname === "127.0.0.1" &&
  scope.cloudId === "qa-cloud" &&
  scope.accountId === "qa-user" &&
  siteUrl === "https://example.atlassian.net" &&
  window.__qaTableFieldApply?.() === true;
