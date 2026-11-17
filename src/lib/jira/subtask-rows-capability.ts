import type { JiraQueryScope } from "./query-scope";

export type SubtaskRowsCapability = (scope: JiraQueryScope, siteUrl: string) => boolean;

export const subtaskRowsAllowed: SubtaskRowsCapability = () => false;
