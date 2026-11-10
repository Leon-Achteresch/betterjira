import { Schema } from "effect";
import type { AdfNode } from "./adf";
import { isMentionable, JiraPerson } from "./people";

export const RawComment = Schema.Struct({
  id: Schema.String,
  parentId: Schema.optional(Schema.NullOr(Schema.Union([Schema.String, Schema.Number]))),
  author: Schema.optional(JiraPerson),
  body: Schema.Unknown,
  created: Schema.String,
});

export type IssueComment = { id: string; parentId?: string; author?: JiraPerson; body: unknown; created: string };

export type CommentThread = { root: IssueComment; replies: IssueComment[] };

export const toIssueComment = ({ parentId, ...comment }: typeof RawComment.Type): IssueComment => ({
  ...comment,
  ...(parentId !== undefined && parentId !== null && { parentId: String(parentId) }),
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
  // Replies whose parent is gone share their parentId as thread key, so they form one thread.
  const keyOf = (comment: IssueComment) => {
    const anchor = byId.get(anchorOf(comment, byId)) ?? comment;
    return anchor.parentId && !byId.has(anchor.parentId) ? `parent:${anchor.parentId}` : anchor.id;
  };
  const threads = new Map<string, CommentThread>();
  for (const comment of sorted) {
    const key = keyOf(comment);
    if (anchorOf(comment, byId) === comment.id && !threads.has(key)) threads.set(key, { root: comment, replies: [] });
  }
  for (const comment of sorted) {
    const thread = threads.get(keyOf(comment));
    if (thread && thread.root !== comment) thread.replies.push(comment);
  }
  const ordered = [...threads.values()];
  return newestFirst ? ordered.reverse() : ordered;
};

export const replyPayload = (body: AdfNode, key: string) => ({ body, parentId: /^\d+$/.test(key) ? Number(key) : key });

export const replyPrefill = (author: JiraPerson | undefined, myAccountId: string | undefined): AdfNode | undefined =>
  author?.accountId && author.accountId !== myAccountId && isMentionable(author)
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
