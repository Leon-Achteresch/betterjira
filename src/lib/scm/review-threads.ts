import { Data, Effect, Option, Schema } from "effect";
import { scm, ScmApiError } from "./client";
import { graphqlUrl } from "./github";
import type { PullRequest, ScmConnection } from "./model";
import { reviewThreadsAllowed } from "@/lib/scm/review-threads-capability";

const LIMIT = 8;
const QUERY = `
query N23ReviewThreads($owner: String!, $name: String!, $number: Int!, $first: Int!) {
  viewer { login }
  repository(owner: $owner, name: $name) {
    nameWithOwner
    pullRequest(number: $number) {
      number url
      reviewThreads(first: $first) {
        totalCount pageInfo { hasNextPage }
        nodes { id path isResolved isOutdated comments(first: 1) { nodes { url } } }
      }
    }
  }
}`;

const CommentLink = Schema.Struct({ url: Schema.String });
const Thread = Schema.Struct({
  id: Schema.NonEmptyString,
  path: Schema.NonEmptyString,
  isResolved: Schema.Boolean,
  isOutdated: Schema.Boolean,
  comments: Schema.optional(Schema.Unknown),
});
const Comments = Schema.Struct({ nodes: Schema.Array(Schema.Unknown) });
const Page = Schema.Struct({
  totalCount: Schema.Number,
  pageInfo: Schema.Struct({ hasNextPage: Schema.Boolean }),
  nodes: Schema.Array(Schema.Unknown),
});
const Response = Schema.Struct({
  errors: Schema.optional(
    Schema.Array(Schema.Struct({ type: Schema.optional(Schema.String) })),
  ),
  data: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        viewer: Schema.optional(
          Schema.NullOr(Schema.Struct({ login: Schema.String })),
        ),
        repository: Schema.optional(
          Schema.NullOr(
            Schema.Struct({
              nameWithOwner: Schema.String,
              pullRequest: Schema.NullOr(
                Schema.Struct({
                  number: Schema.Number,
                  url: Schema.String,
                  reviewThreads: Schema.optional(Schema.NullOr(Page)),
                }),
              ),
            }),
          ),
        ),
      }),
    ),
  ),
});
const decodeThread = Schema.decodeUnknownOption(Thread);
const isComments = Schema.is(Comments);
const isCommentLink = Schema.is(CommentLink);

type Subject = {
  connection: ScmConnection;
  repo: string;
  pr: Pick<PullRequest, "url" | "number">;
};

const httpsUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search
    )
      return url;
  } catch {
    return undefined;
  }
};
const equal = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function requestUrl({ connection, repo, pr }: Subject, segment: string) {
  const base = httpsUrl(connection.baseUrl);
  const [owner, name, extra] = repo.split("/");
  if (
    !base ||
    base.pathname !== "/" ||
    base.hash ||
    !owner ||
    !name ||
    extra !== undefined ||
    ![owner, name].every(
      (part) => /^[\w.-]+$/.test(part) && part !== "." && part !== "..",
    ) ||
    !Number.isSafeInteger(pr.number) ||
    pr.number < 1 ||
    pr.number > 2_147_483_647
  )
    return;
  const url = httpsUrl(pr.url);
  if (
    !url ||
    url.hash ||
    url.origin !== base.origin ||
    !equal(url.pathname, `/${owner}/${name}/${segment}/${pr.number}`)
  )
    return;
  return { url, owner, name };
}

export function githubReviewTarget(subject: Subject) {
  const { connection } = subject;
  if (connection.kind !== "github" || !connection.account?.trim()) return;
  const target = requestUrl(subject, "pull");
  if (
    !target ||
    (connection.auth.kind === "gh" && connection.auth.host !== target.url.host)
  )
    return;
  return target;
}

export function bitbucketReviewOriginal(subject: Subject) {
  if (subject.connection.kind !== "bitbucket-cloud") return;
  return requestUrl(subject, "pull-requests")?.url.href;
}

function originalLink(comments: unknown, pr: URL) {
  if (
    !isComments(comments) ||
    comments.nodes.length !== 1 ||
    !isCommentLink(comments.nodes[0])
  )
    return;
  const url = httpsUrl(comments.nodes[0].url);
  if (
    url &&
    url.origin === pr.origin &&
    equal(url.pathname, pr.pathname) &&
    /^#discussion_r\d+$/.test(url.hash)
  )
    return url.href;
}

class ReviewThreadsUnconfirmed extends Data.TaggedError(
  "ReviewThreadsUnconfirmed",
)<{}> {}
class ReviewThreadsForbidden extends Data.TaggedError(
  "ReviewThreadsForbidden",
)<{}> {}

export const readReviewThreads = (subject: Subject, isCurrent: () => boolean) =>
  Effect.gen(function* () {
    const { connection, repo, pr } = subject;
    const target = githubReviewTarget(subject);
    if (!target || !reviewThreadsAllowed(connection) || !isCurrent())
      return yield* new ReviewThreadsUnconfirmed();

    const { owner, name, url } = target;
    const response = yield* scm(
      connection.auth,
      graphqlUrl(connection),
      Response,
      {
        method: "POST",
        body: {
          query: QUERY,
          variables: { owner, name, number: pr.number, first: LIMIT },
        },
      },
    );
    if (!isCurrent()) return yield* new ReviewThreadsUnconfirmed();
    if (
      response.errors?.some(
        ({ type }) =>
          type === "FORBIDDEN" ||
          type === "UNAUTHORIZED" ||
          type === "NOT_FOUND",
      )
    )
      return yield* new ReviewThreadsForbidden();

    const repository = response.data?.repository;
    const viewer = response.data?.viewer;
    const ticket = repository?.pullRequest;
    if (!repository || !ticket) return yield* new ReviewThreadsForbidden();
    if (
      !viewer ||
      !equal(viewer.login, connection.account ?? "") ||
      !equal(repository.nameWithOwner, repo) ||
      ticket.number !== pr.number ||
      requestUrl(
        { connection, repo, pr: ticket },
        "pull",
      )?.url.href.toLowerCase() !== url.href.toLowerCase()
    )
      return yield* new ReviewThreadsUnconfirmed();

    const page = ticket.reviewThreads;
    if (
      !page ||
      !Number.isSafeInteger(page.totalCount) ||
      page.totalCount < page.nodes.length ||
      page.nodes.length > LIMIT
    )
      return yield* new ReviewThreadsUnconfirmed();
    const decoded = page.nodes.flatMap((raw) =>
      Option.toArray(decodeThread(raw)),
    );
    const ids = new Set(decoded.map(({ id }) => id));
    if (ids.size !== decoded.length)
      return yield* new ReviewThreadsUnconfirmed();
    const threads = decoded.map(
      ({ id, path, isResolved, isOutdated, comments }) => ({
        id,
        path,
        resolved: isResolved,
        outdated: isOutdated,
        url: originalLink(comments, url),
      }),
    );
    return {
      threads,
      partial:
        !!response.errors?.length ||
        page.pageInfo.hasNextPage ||
        page.totalCount > threads.length ||
        page.nodes.length !== threads.length,
    };
  });

export type ReviewThreads = Effect.Success<
  ReturnType<typeof readReviewThreads>
>;

export function reviewThreadsError(error: unknown) {
  if (
    error instanceof ReviewThreadsForbidden ||
    (error instanceof ScmApiError && [401, 403, 404].includes(error.status))
  )
    return "Kein bestätigter Lesezugriff auf die Reviewgespräche.";
  return "Die Reviewgespräche konnten für diese Verbindung und diesen Pull Request nicht bestätigt werden.";
}
