import { Effect, Schema } from "effect";
import { scm } from "./client";
import { mentionsIssue } from "./issue-key";
import { combineChecks, type CheckState, type PullRequest, type PullRequestDraft, type ScmConnection } from "./model";
import type { ScmProvider } from "./provider";

const API = "https://api.bitbucket.org/2.0";

const Link = Schema.Struct({ href: Schema.String });
const Account = Schema.NullOr(Schema.Struct({ display_name: Schema.String, links: Schema.Struct({ avatar: Schema.optional(Link) }) }));

const CloudPullRequest = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  state: Schema.String,
  draft: Schema.optional(Schema.Boolean),
  updated_on: Schema.String,
  author: Account,
  source: Schema.Struct({
    branch: Schema.Struct({ name: Schema.String }),
    commit: Schema.NullOr(Schema.Struct({ hash: Schema.String })),
  }),
  destination: Schema.Struct({ branch: Schema.Struct({ name: Schema.String }) }),
  links: Schema.Struct({ html: Link }),
  participants: Schema.optional(
    Schema.Array(
      Schema.Struct({
        user: Account,
        role: Schema.String,
        approved: Schema.Boolean,
        state: Schema.optional(Schema.NullOr(Schema.String)),
      }),
    ),
  ),
});
type CloudPullRequest = typeof CloudPullRequest.Type;

const page = <S extends Schema.Top>(item: S) =>
  Schema.Struct({ values: Schema.Array(item), next: Schema.optional(Schema.String) });

const Status = Schema.Struct({ state: Schema.String });
const Branch = Schema.Struct({ name: Schema.String, links: Schema.Struct({ html: Link }), target: Schema.Struct({ hash: Schema.String }) });

const quote = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

const statusState = (state: string): CheckState =>
  state === "SUCCESSFUL" ? "success" : state === "INPROGRESS" ? "pending" : "failure";

const checksFor = (connection: ScmConnection, repo: string, pr: CloudPullRequest) =>
  pr.state !== "OPEN"
    ? Effect.succeed(null)
    : scm(connection.auth, `${API}/repositories/${repo}/pullrequests/${pr.id}/statuses?pagelen=50`, page(Status)).pipe(
        Effect.map(({ values }) => combineChecks(values.map(({ state }) => statusState(state)))),
        Effect.orElseSucceed(() => null),
      );

const toPullRequest = (pr: CloudPullRequest, checks: CheckState | null): PullRequest => ({
  url: pr.links.html.href,
  number: pr.id,
  title: pr.title,
  state: pr.state === "OPEN" ? (pr.draft ? "draft" : "open") : pr.state === "MERGED" ? "merged" : "closed",
  source: pr.source.branch.name,
  target: pr.destination.branch.name,
  author: pr.author && { name: pr.author.display_name, avatarUrl: pr.author.links.avatar?.href ?? null },
  updatedAt: pr.updated_on,
  checks,
  reviewers: (pr.participants ?? []).flatMap((participant) =>
    participant.user && (participant.role === "REVIEWER" || participant.approved || participant.state)
      ? [
          {
            name: participant.user.display_name,
            avatarUrl: participant.user.links.avatar?.href ?? null,
            state: participant.approved ? "approved" : participant.state === "changes_requested" ? "changes" : "pending",
          } as const,
        ]
      : [],
  ),
});

const development = (connection: ScmConnection, repo: string, issueKey: string) =>
  Effect.gen(function* () {
    const filter = `title ~ ${quote(issueKey)} OR source.branch.name ~ ${quote(issueKey)}`;
    const states = ["OPEN", "MERGED", "DECLINED", "SUPERSEDED"].map((state) => `state=${state}`).join("&");
    const [prs, branches] = yield* Effect.all(
      [
        scm(
          connection.auth,
          `${API}/repositories/${repo}/pullrequests?${states}&pagelen=20&fields=%2Bvalues.participants&q=${encodeURIComponent(filter)}`,
          page(CloudPullRequest),
        ),
        scm(
          connection.auth,
          `${API}/repositories/${repo}/refs/branches?pagelen=20&q=${encodeURIComponent(`name ~ ${quote(issueKey)}`)}`,
          page(Branch),
        ),
      ],
      { concurrency: 2 },
    );
    const matching = prs.values.filter((pr) => mentionsIssue(pr.title, issueKey) || mentionsIssue(pr.source.branch.name, issueKey));
    const pullRequests = yield* Effect.forEach(
      matching,
      (pr) => checksFor(connection, repo, pr).pipe(Effect.map((checks) => toPullRequest(pr, checks))),
      { concurrency: 4 },
    );
    return {
      pullRequests,
      branches: branches.values
        .filter((branch) => mentionsIssue(branch.name, issueKey))
        .map((branch) => ({ name: branch.name, url: branch.links.html.href })),
    };
  });

const Repository = Schema.Struct({ mainbranch: Schema.NullOr(Schema.Struct({ name: Schema.String })) });

const createBranch = (connection: ScmConnection, repo: string, name: string) =>
  Effect.gen(function* () {
    const { mainbranch } = yield* scm(connection.auth, `${API}/repositories/${repo}`, Repository);
    const base = yield* scm(
      connection.auth,
      `${API}/repositories/${repo}/refs/branches/${encodeURIComponent(mainbranch?.name ?? "main")}`,
      Branch,
    );
    const created = yield* scm(connection.auth, `${API}/repositories/${repo}/refs/branches`, Branch, {
      method: "POST",
      body: { name, target: { hash: base.target.hash } },
    });
    return { name: created.name, url: created.links.html.href };
  });

const createPullRequest = (connection: ScmConnection, repo: string, draft: PullRequestDraft) =>
  scm(connection.auth, `${API}/repositories/${repo}/pullrequests`, Schema.Struct({ links: Schema.Struct({ html: Link }) }), {
    method: "POST",
    body: { title: draft.title, description: draft.body, source: { branch: { name: draft.branch } } },
  }).pipe(Effect.map((created) => created.links.html.href));

const MAX_PAGES = 10;

const repos = (connection: ScmConnection) =>
  Effect.gen(function* () {
    const names: string[] = [];
    let url: string | undefined = `${API}/repositories?role=member&pagelen=100&sort=-updated_on&fields=next,values.full_name`;
    for (let index = 0; url && index < MAX_PAGES; index++) {
      const batch: { values: readonly { full_name: string }[]; next?: string } = yield* scm(
        connection.auth,
        url,
        page(Schema.Struct({ full_name: Schema.String })),
      );
      names.push(...batch.values.map((repo) => repo.full_name));
      url = batch.next;
    }
    return names;
  });

const verify = (connection: ScmConnection) =>
  scm(connection.auth, `${API}/user`, Schema.Struct({ display_name: Schema.String })).pipe(Effect.map((user) => user.display_name));

export const bitbucketCloud: ScmProvider = { development, createBranch, createPullRequest, repos, verify };
