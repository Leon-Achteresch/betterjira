import { Effect, Schema } from "effect";
import { scm, ScmError } from "./client";
import { mentionsIssue } from "./issue-key";
import type { CheckState, PullRequest, PullRequestDraft, RepoDevelopment, ReviewState, ScmConnection } from "./model";
import type { ScmProvider } from "./provider";

const hostOf = (connection: ScmConnection) => new URL(connection.baseUrl).host;

const restBase = (connection: ScmConnection) => {
  const host = hostOf(connection);
  if (host === "github.com") return "https://api.github.com";
  if (host.endsWith(".ghe.com")) return `https://api.${host}`;
  return `https://${host}/api/v3`;
};

const graphqlUrl = (connection: ScmConnection) => {
  const host = hostOf(connection);
  return host === "github.com" || host.endsWith(".ghe.com") ? `${restBase(connection)}/graphql` : `https://${host}/api/graphql`;
};

const Actor = Schema.NullOr(Schema.Struct({ login: Schema.String, avatarUrl: Schema.String }));

const GraphPullRequest = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  url: Schema.String,
  state: Schema.Literals(["OPEN", "CLOSED", "MERGED"]),
  isDraft: Schema.Boolean,
  headRefName: Schema.String,
  baseRefName: Schema.String,
  updatedAt: Schema.String,
  author: Actor,
  latestReviews: Schema.Struct({ nodes: Schema.Array(Schema.Struct({ state: Schema.String, author: Actor })) }),
  reviewRequests: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({
        requestedReviewer: Schema.NullOr(
          Schema.Struct({
            login: Schema.optional(Schema.String),
            name: Schema.optional(Schema.NullOr(Schema.String)),
            avatarUrl: Schema.optional(Schema.String),
          }),
        ),
      }),
    ),
  }),
  commits: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({ commit: Schema.Struct({ statusCheckRollup: Schema.NullOr(Schema.Struct({ state: Schema.String })) }) }),
    ),
  }),
});
type GraphPullRequest = typeof GraphPullRequest.Type;

const DevelopmentResponse = Schema.Struct({
  data: Schema.NullOr(
    Schema.Struct({
      search: Schema.Struct({ nodes: Schema.Array(GraphPullRequest) }),
      repository: Schema.NullOr(
        Schema.Struct({
          refs: Schema.Struct({
            nodes: Schema.Array(
              Schema.Struct({
                name: Schema.String,
                associatedPullRequests: Schema.Struct({ nodes: Schema.Array(GraphPullRequest) }),
              }),
            ),
          }),
        }),
      ),
    }),
  ),
  errors: Schema.optional(Schema.Array(Schema.Struct({ message: Schema.String }))),
});

const PULL_REQUEST_FIELDS = `
  number title url state isDraft headRefName baseRefName updatedAt
  author { login avatarUrl }
  latestReviews(first: 10) { nodes { state author { login avatarUrl } } }
  reviewRequests(first: 10) { nodes { requestedReviewer { ... on User { login avatarUrl } ... on Team { name avatarUrl } } } }
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }`;

const DEVELOPMENT_QUERY = `
query($owner: String!, $name: String!, $search: String!, $key: String!) {
  search(query: $search, type: ISSUE, first: 20) { nodes { ... on PullRequest { ${PULL_REQUEST_FIELDS} } } }
  repository(owner: $owner, name: $name) {
    refs(refPrefix: "refs/heads/", query: $key, first: 20) {
      nodes { name associatedPullRequests(first: 5) { nodes { ${PULL_REQUEST_FIELDS} } } }
    }
  }
}`;

const REVIEW_STATES: Partial<Record<string, ReviewState>> = { APPROVED: "approved", CHANGES_REQUESTED: "changes" };

const checkState = (state: string | undefined): CheckState | null => {
  if (state === "SUCCESS") return "success";
  if (state === "FAILURE" || state === "ERROR") return "failure";
  if (state === "PENDING" || state === "EXPECTED") return "pending";
  return null;
};

const toPullRequest = (pr: GraphPullRequest): PullRequest => {
  const reviewed = pr.latestReviews.nodes.flatMap(({ state, author }) => {
    const review = REVIEW_STATES[state];
    return review && author ? [{ name: author.login, avatarUrl: author.avatarUrl, state: review }] : [];
  });
  const requested = pr.reviewRequests.nodes.flatMap(({ requestedReviewer }) => {
    const name = requestedReviewer?.login ?? requestedReviewer?.name;
    return name ? [{ name, avatarUrl: requestedReviewer?.avatarUrl ?? null, state: "pending" as const }] : [];
  });
  return {
    url: pr.url,
    number: pr.number,
    title: pr.title,
    state: pr.state === "OPEN" ? (pr.isDraft ? "draft" : "open") : pr.state === "MERGED" ? "merged" : "closed",
    source: pr.headRefName,
    target: pr.baseRefName,
    author: pr.author && { name: pr.author.login, avatarUrl: pr.author.avatarUrl },
    updatedAt: pr.updatedAt,
    checks: checkState(pr.commits.nodes[0]?.commit.statusCheckRollup?.state),
    reviewers: [...reviewed, ...requested.filter(({ name }) => !reviewed.some((review) => review.name === name))],
  };
};

const splitRepo = (repo: string) => {
  const [owner = "", name = ""] = repo.split("/");
  return { owner, name };
};

const development = (connection: ScmConnection, repo: string, issueKey: string) =>
  Effect.gen(function* () {
    const { owner, name } = splitRepo(repo);
    const response = yield* scm(connection.auth, graphqlUrl(connection), DevelopmentResponse, {
      method: "POST",
      body: {
        query: DEVELOPMENT_QUERY,
        variables: { owner, name, key: issueKey, search: `"${issueKey}" is:pr repo:${repo}` },
      },
    });
    if (!response.data) return yield* new ScmError({ message: response.errors?.[0]?.message ?? "GitHub lieferte keine Daten" });
    const branches = (response.data.repository?.refs.nodes ?? []).filter((ref) => mentionsIssue(ref.name, issueKey));
    const pullRequests = new Map<string, PullRequest>();
    for (const pr of [...response.data.search.nodes, ...branches.flatMap((ref) => ref.associatedPullRequests.nodes)]) {
      pullRequests.set(pr.url, toPullRequest(pr));
    }
    return {
      pullRequests: [...pullRequests.values()],
      branches: branches.map((ref) => ({ name: ref.name, url: `${connection.baseUrl}/${repo}/tree/${encodeURI(ref.name)}` })),
    } satisfies RepoDevelopment;
  });

const Repository = Schema.Struct({ default_branch: Schema.String, html_url: Schema.String });
const GitRef = Schema.Struct({ object: Schema.Struct({ sha: Schema.String }) });

const repository = (connection: ScmConnection, repo: string) =>
  scm(connection.auth, `${restBase(connection)}/repos/${repo}`, Repository);

const createBranch = (connection: ScmConnection, repo: string, name: string) =>
  Effect.gen(function* () {
    const { default_branch, html_url } = yield* repository(connection, repo);
    const base = yield* scm(connection.auth, `${restBase(connection)}/repos/${repo}/git/ref/heads/${encodeURI(default_branch)}`, GitRef);
    yield* scm(connection.auth, `${restBase(connection)}/repos/${repo}/git/refs`, GitRef, {
      method: "POST",
      body: { ref: `refs/heads/${name}`, sha: base.object.sha },
    });
    return { name, url: `${html_url}/tree/${encodeURI(name)}` };
  });

const createPullRequest = (connection: ScmConnection, repo: string, draft: PullRequestDraft) =>
  Effect.gen(function* () {
    const { default_branch } = yield* repository(connection, repo);
    const created = yield* scm(connection.auth, `${restBase(connection)}/repos/${repo}/pulls`, Schema.Struct({ html_url: Schema.String }), {
      method: "POST",
      body: { title: draft.title, body: draft.body, head: draft.branch, base: default_branch },
    });
    return created.html_url;
  });

const RepoPage = Schema.Array(Schema.Struct({ full_name: Schema.String }));
const MAX_PAGES = 10;

const repos = (connection: ScmConnection) =>
  Effect.gen(function* () {
    const names: string[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = yield* scm(
        connection.auth,
        `${restBase(connection)}/user/repos?per_page=100&sort=pushed&page=${page}`,
        RepoPage,
      );
      names.push(...batch.map((repo) => repo.full_name));
      if (batch.length < 100) break;
    }
    return names;
  });

const verify = (connection: ScmConnection) =>
  scm(connection.auth, `${restBase(connection)}/user`, Schema.Struct({ login: Schema.String })).pipe(Effect.map((user) => user.login));

export const github: ScmProvider = { development, createBranch, createPullRequest, repos, verify };
