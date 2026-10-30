import type { Effect } from "effect";
import { bitbucketCloud } from "./bitbucket-cloud";
import { bitbucketDataCenter } from "./bitbucket-dc";
import type { ScmApiError, ScmError } from "./client";
import { github } from "./github";
import type { PullRequestDraft, RepoDevelopment, ScmBranch, ScmConnection, ScmKind } from "./model";

type ScmEffect<A> = Effect.Effect<A, ScmError | ScmApiError>;

export type ScmProvider = {
  development: (connection: ScmConnection, repo: string, issueKey: string) => ScmEffect<RepoDevelopment>;
  createBranch: (connection: ScmConnection, repo: string, name: string) => ScmEffect<ScmBranch>;
  createPullRequest: (connection: ScmConnection, repo: string, draft: PullRequestDraft) => ScmEffect<string>;
  repos: (connection: ScmConnection) => ScmEffect<string[]>;
  verify: (connection: ScmConnection) => ScmEffect<string | null>;
};

export const providerFor = (kind: ScmKind): ScmProvider =>
  kind === "github" ? github : kind === "bitbucket-cloud" ? bitbucketCloud : bitbucketDataCenter;
