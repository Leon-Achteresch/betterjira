import type { JiraQueryScope } from "./query-scope";

export type TableFieldApplyCapability = (scope: JiraQueryScope, siteUrl: string) => boolean;

export const tableFieldApplyAllowed: TableFieldApplyCapability = () => false;
