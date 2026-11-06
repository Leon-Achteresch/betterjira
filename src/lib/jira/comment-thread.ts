import { Effect, Schema } from "effect";
import type { AdfNode } from "./adf";
import { JiraPerson } from "./people";

export const COMMENT_PAGE_SIZE = 100;

export const RawComment = Schema.Struct({
  id: Schema.String,
  parentId: Schema.optional(Schema.NullOr(Schema.Union([Schema.String, Schema.Number]))),
  author: Schema.optional(JiraPerson),
  body: Schema.Unknown,
  created: Schema.String,
});

export const CommentPage = Schema.Struct({
  startAt: Schema.Number,
  maxResults: Schema.Number,
  total: Schema.Number,
  comments: Schema.Array(RawComment),
});

export type IssueComment = { id: string; parentId?: string; author?: JiraPerson; body: unknown; created: string };

export type CommentThread = { root: IssueComment; replies: IssueComment[] };

export const toIssueComment = ({ parentId, ...comment }: typeof RawComment.Type): IssueComment => ({
  ...comment,
  ...(parentId !== undefined && parentId !== null && { parentId: String(parentId) }),
});

export const collectCommentPages = <E>(fetchPage: (startAt: number) => Effect.Effect<typeof CommentPage.Type, E>) =>
  Effect.gen(function* () {
    const comments: IssueComment[] = [];
    while (true) {
      const page = yield* fetchPage(comments.length);
      comments.push(...page.comments.map(toIssueComment));
      if (page.comments.length === 0 || comments.length >= page.total) return comments;
    }
  });

export const threadKey = (comment: IssueComment) => comment.parentId ?? comment.id;

const byCreated = (a: IssueComment, b: IssueComment) => Date.parse(a.created) - Date.parse(b.created);

const anchorOf = (comment: IssueComment, byId: ReadonlyMap<string, IssueComment>) => {
  const seen = new Set([comment.id]);
  let current = comment;
  let parent = current.parentId ? byId.get(current.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    current = parent;
    parent = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return current.id;
};

export const buildThreads = (comments: readonly IssueComment[], newestFirst: boolean): CommentThread[] => {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const sorted = [...comments].sort(byCreated);
  const threads = new Map<string, CommentThread>();
  for (const comment of sorted) {
    if (anchorOf(comment, byId) === comment.id) threads.set(comment.id, { root: comment, replies: [] });
  }
  for (const comment of sorted) {
    const anchor = anchorOf(comment, byId);
    if (anchor !== comment.id) threads.get(anchor)?.replies.push(comment);
  }
  const ordered = [...threads.values()];
  return newestFirst ? ordered.reverse() : ordered;
};

export const commentCount = (
  loaded: readonly IssueComment[] | undefined,
  embedded: { readonly total?: number; readonly comments: readonly unknown[] } | undefined,
) => loaded?.length ?? embedded?.total ?? embedded?.comments.length ?? 0;

export const replyPayload = (body: AdfNode, key: string) => ({ body, parentId: /^\d+$/.test(key) ? Number(key) : key });

export const replyPrefill = (author: JiraPerson | undefined, myAccountId: string | undefined): AdfNode | undefined =>
  author?.accountId && author.accountId !== myAccountId
    ? {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              { type: "mention", attrs: { id: author.accountId, text: `@${author.displayName}` } },
              { type: "text", text: " " },
            ],
          },
        ],
      }
    : undefined;
