import type { JiraQueryScope } from "./query-scope";

export type WorklogEstimateCapability = (
  scope: JiraQueryScope,
  siteUrl: string,
) => boolean;
export const worklogEstimateAllowed: WorklogEstimateCapability = () => false;
