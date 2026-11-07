import { RECENT_ISSUE_LIMIT, type IssueContext, type RememberedIssue, type Workspace } from "@/lib/workspace";

export type RemovedRecentIssue = {
  issue: RememberedIssue;
  following: readonly string[];
  context?: IssueContext;
};

export const removeRecentIssue = (
  workspace: Workspace,
  key: string,
): { workspace: Workspace; removed?: RemovedRecentIssue } => {
  const index = workspace.recent.findIndex((issue) => issue.key === key);
  if (index === -1) return { workspace };
  const context = workspace.contexts?.[key];
  return {
    workspace: { ...workspace, recent: workspace.recent.filter((issue) => issue.key !== key) },
    removed: {
      issue: workspace.recent[index],
      following: workspace.recent.slice(index + 1).map((issue) => issue.key),
      ...(context && { context }),
    },
  };
};

export const restoreRecentIssue = (workspace: Workspace, removed: RemovedRecentIssue): Workspace => {
  const { key } = removed.issue;
  if (workspace.recent.some((issue) => issue.key === key)) return workspace;
  const following = new Set(removed.following);
  const position = workspace.recent.reduce((last, issue, index) => (following.has(issue.key) ? last : index + 1), 0);
  if (position >= RECENT_ISSUE_LIMIT) return workspace;
  const recent = [...workspace.recent.slice(0, position), removed.issue, ...workspace.recent.slice(position)].slice(
    0,
    RECENT_ISSUE_LIMIT,
  );
  const missingContext = removed.context && !workspace.contexts?.[key] ? { [key]: removed.context } : undefined;
  return {
    ...workspace,
    recent,
    ...(missingContext && { contexts: { ...workspace.contexts, ...missingContext } }),
  };
};
