export type TimeTrackingScope = { cloudId: string; accountId: string; start: number; end: number };

const scopeKey = ({ cloudId, accountId, start, end }: TimeTrackingScope) => [cloudId, accountId, start, end] as const;

export const timeTrackingKeys = {
  all: ["jira", "time-tracking"] as const,
  candidates: (scope: TimeTrackingScope) => [...timeTrackingKeys.all, "issues", ...scopeKey(scope)] as const,
  worklogs: (scope: TimeTrackingScope, issueId: string) => [...timeTrackingKeys.all, "worklogs", ...scopeKey(scope), issueId] as const,
};
