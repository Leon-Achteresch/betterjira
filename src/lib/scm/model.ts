export type ScmKind = "github" | "bitbucket-cloud" | "bitbucket-dc";

export type ScmAuth = { kind: "gh"; host: string } | { kind: "token"; id: string; username: string | null };

export type ScmConnection = {
  id: string;
  kind: ScmKind;
  label: string;
  baseUrl: string;
  account: string | null;
  auth: ScmAuth;
};

export type RepoLink = { connectionId: string; repo: string };

export type PullRequestState = "open" | "draft" | "merged" | "closed";
export type CheckState = "success" | "failure" | "pending";
export type ReviewState = "approved" | "changes" | "pending";

export type ScmPerson = { name: string; avatarUrl: string | null };

export type PullRequest = {
  url: string;
  number: number;
  title: string;
  state: PullRequestState;
  source: string;
  target: string;
  author: ScmPerson | null;
  updatedAt: string;
  checks: CheckState | null;
  reviewers: Array<ScmPerson & { state: ReviewState }>;
};

export type ScmBranch = { name: string; url: string };

export type RepoDevelopment = { pullRequests: PullRequest[]; branches: ScmBranch[] };

export type NewConnection = { kind: ScmKind; baseUrl: string; username: string; token: string };

export type PullRequestDraft = { branch: string; title: string; body: string };

export const SCM_KIND_LABELS: Record<ScmKind, string> = {
  github: "GitHub",
  "bitbucket-cloud": "Bitbucket Cloud",
  "bitbucket-dc": "Bitbucket Data Center",
};

export const CHECK_PRIORITY: Record<CheckState, number> = { failure: 2, pending: 1, success: 0 };

export const combineChecks = (states: CheckState[]): CheckState | null =>
  states.length === 0 ? null : states.reduce((worst, state) => (CHECK_PRIORITY[state] > CHECK_PRIORITY[worst] ? state : worst));
