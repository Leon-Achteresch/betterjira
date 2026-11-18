import type { JiraQueryScope } from "./query-scope";

export type BulkTransitionCommentCapability = (scope: JiraQueryScope, siteUrl: string) => boolean;

export const bulkTransitionCommentAllowed: BulkTransitionCommentCapability = () => false;
