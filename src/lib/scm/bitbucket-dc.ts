import { Effect, Schema } from "effect";
import { scm } from "./client";
import { mentionsIssue } from "./issue-key";
import type { CheckState, PullRequest, PullRequestDraft, ScmConnection } from "./model";
import type { ScmProvider } from "./provider";

const api = (connection: ScmConnection) => `${connection.baseUrl}/rest/api/latest`;

const repoPath = (repo: string) => {
  const [project = "", slug = ""] = repo.split("/");
  return `projects/${encodeURIComponent(project)}/repos/${encodeURIComponent(slug)}`;
};

const User = Schema.Struct({ displayName: Schema.String });

const ServerPullRequest = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  state: Schema.String,
  draft: Schema.optional(Schema.Boolean),
  updatedDate: Schema.Number,
  author: Schema.Struct({ user: User }),
  fromRef: Schema.Struct({ displayId: Schema.String, latestCommit: Schema.optional(Schema.String) }),
  toRef: Schema.Struct({ displayId: Schema.String }),
  reviewers: Schema.Array(Schema.Struct({ user: User, status: Schema.String })),
  links: Schema.Struct({ self: Schema.Array(Schema.Struct({ href: Schema.String })) }),
});
type ServerPullRequest = typeof ServerPullRequest.Type;

const page = <S extends Schema.Top>(item: S) => Schema.Struct({ values: Schema.Array(item) });

const Ref = Schema.Struct({ id: Schema.String, displayId: Schema.String });
const BuildStats = Schema.Struct({ successful: Schema.Number, failed: Schema.Number, inProgress: Schema.Number });

const checksFor = (connection: ScmConnection, pr: ServerPullRequest) =>
  pr.state !== "OPEN" || !pr.fromRef.latestCommit
    ? Effect.succeed(null)
    : scm(connection.auth, `${connection.baseUrl}/rest/build-status/1.0/commits/stats/${pr.fromRef.latestCommit}`, BuildStats).pipe(
        Effect.map((stats): CheckState | null =>
          stats.failed > 0 ? "failure" : stats.inProgress > 0 ? "pending" : stats.successful > 0 ? "success" : null,
        ),
        Effect.orElseSucceed(() => null),
      );

const toPullRequest = (pr: ServerPullRequest, checks: CheckState | null): PullRequest => ({
  url: pr.links.self[0]?.href ?? "",
  number: pr.id,
  title: pr.title,
  state: pr.state === "OPEN" ? (pr.draft ? "draft" : "open") : pr.state === "MERGED" ? "merged" : "closed",
  source: pr.fromRef.displayId,
  target: pr.toRef.displayId,
  author: { name: pr.author.user.displayName, avatarUrl: null },
  updatedAt: new Date(pr.updatedDate).toISOString(),
  checks,
  reviewers: pr.reviewers.map((reviewer) => ({
    name: reviewer.user.displayName,
    avatarUrl: null,
    state: reviewer.status === "APPROVED" ? "approved" : reviewer.status === "NEEDS_WORK" ? "changes" : "pending",
  })),
});

const branchUrl = (connection: ScmConnection, repo: string, ref: { id: string }) =>
  `${connection.baseUrl}/${repoPath(repo)}/browse?at=${encodeURIComponent(ref.id)}`;

const development = (connection: ScmConnection, repo: string, issueKey: string) =>
  Effect.gen(function* () {
    const base = `${api(connection)}/${repoPath(repo)}`;
    const filter = encodeURIComponent(issueKey);
    const [titled, branchPage] = yield* Effect.all(
      [
        scm(connection.auth, `${base}/pull-requests?state=ALL&limit=25&filterText=${filter}`, page(ServerPullRequest)),
        scm(connection.auth, `${base}/branches?limit=25&filterText=${filter}`, page(Ref)),
      ],
      { concurrency: 2 },
    );
    const branches = branchPage.values.filter((branch) => mentionsIssue(branch.displayId, issueKey));
    const fromBranches = yield* Effect.forEach(
      branches,
      (branch) =>
        scm(
          connection.auth,
          `${base}/pull-requests?state=ALL&direction=OUTGOING&limit=5&at=${encodeURIComponent(branch.id)}`,
          page(ServerPullRequest),
        ).pipe(Effect.map(({ values }) => values)),
      { concurrency: 4 },
    );
    const unique = new Map<number, ServerPullRequest>();
    for (const pr of [...titled.values, ...fromBranches.flat()]) {
      if (mentionsIssue(pr.title, issueKey) || mentionsIssue(pr.fromRef.displayId, issueKey)) unique.set(pr.id, pr);
    }
    const pullRequests = yield* Effect.forEach(
      [...unique.values()],
      (pr) => checksFor(connection, pr).pipe(Effect.map((checks) => toPullRequest(pr, checks))),
      { concurrency: 4 },
    );
    return {
      pullRequests,
      branches: branches.map((branch) => ({ name: branch.displayId, url: branchUrl(connection, repo, branch) })),
    };
  });

const defaultBranch = (connection: ScmConnection, repo: string) =>
  scm(connection.auth, `${api(connection)}/${repoPath(repo)}/default-branch`, Ref).pipe(
    Effect.catchTag("ScmApiError", () => scm(connection.auth, `${api(connection)}/${repoPath(repo)}/branches/default`, Ref)),
  );

const createBranch = (connection: ScmConnection, repo: string, name: string) =>
  Effect.gen(function* () {
    const base = yield* defaultBranch(connection, repo);
    const body = { name, startPoint: base.id };
    const created = yield* scm(connection.auth, `${api(connection)}/${repoPath(repo)}/branches`, Ref, { method: "POST", body }).pipe(
      Effect.catchTag("ScmApiError", (error) =>
        error.status === 404 || error.status === 405
          ? scm(connection.auth, `${connection.baseUrl}/rest/branch-utils/latest/${repoPath(repo)}/branches`, Ref, { method: "POST", body })
          : Effect.fail(error),
      ),
    );
    return { name: created.displayId, url: branchUrl(connection, repo, created) };
  });

const createPullRequest = (connection: ScmConnection, repo: string, draft: PullRequestDraft) =>
  Effect.gen(function* () {
    const target = yield* defaultBranch(connection, repo);
    const created = yield* scm(
      connection.auth,
      `${api(connection)}/${repoPath(repo)}/pull-requests`,
      Schema.Struct({ links: ServerPullRequest.fields.links }),
      {
        method: "POST",
        body: {
          title: draft.title,
          description: draft.body,
          fromRef: { id: `refs/heads/${draft.branch}` },
          toRef: { id: target.id },
        },
      },
    );
    return created.links.self[0]?.href ?? "";
  });

const RepoPage = Schema.Struct({
  values: Schema.Array(Schema.Struct({ slug: Schema.String, project: Schema.Struct({ key: Schema.String }) })),
});

const repos = (connection: ScmConnection) =>
  scm(connection.auth, `${api(connection)}/repos?limit=1000`, RepoPage).pipe(
    Effect.map(({ values }) => values.map((repo) => `${repo.project.key}/${repo.slug}`)),
  );

const verify = (connection: ScmConnection) =>
  scm(connection.auth, `${api(connection)}/repos?limit=1`, Schema.Unknown).pipe(Effect.as(null));

export const bitbucketDataCenter: ScmProvider = { development, createBranch, createPullRequest, repos, verify };
