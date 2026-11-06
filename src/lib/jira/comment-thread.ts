import { Effect, Schema } from "effect";
import type { AdfNode } from "./adf";
import { isMentionable, JiraPerson } from "./people";

export const COMMENT_PAGE_SIZE = 100;

export const CommentVisibility = Schema.Struct({
  type: Schema.String,
  value: Schema.String,
  identifier: Schema.optional(Schema.String),
});

export type CommentVisibility = typeof CommentVisibility.Type;

export const RawComment = Schema.Struct({
  id: Schema.String,
  parentId: Schema.optional(Schema.NullOr(Schema.Union([Schema.String, Schema.Number]))),
  author: Schema.optional(JiraPerson),
  updateAuthor: Schema.optional(Schema.NullOr(JiraPerson)),
  body: Schema.Unknown,
  created: Schema.String,
  updated: Schema.optional(Schema.String),
  visibility: Schema.optional(Schema.NullOr(CommentVisibility)),
});

export const CommentPage = Schema.Struct({
  startAt: Schema.Number,
  maxResults: Schema.Number,
  total: Schema.Number,
  comments: Schema.Array(RawComment),
});

export type IssueComment = {
  id: string;
  parentId?: string;
  author?: JiraPerson;
  updateAuthor?: JiraPerson;
  body: unknown;
  created: string;
  updated?: string;
  visibility?: CommentVisibility;
};

export type CommentThread = { root: IssueComment; replies: IssueComment[] };

export const toIssueComment = ({ parentId, updateAuthor, visibility, ...comment }: typeof RawComment.Type): IssueComment => ({
  ...comment,
  ...(parentId !== undefined && parentId !== null && { parentId: String(parentId) }),
  ...(updateAuthor && { updateAuthor }),
  ...(visibility && { visibility }),
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

export const commentCount = (
  loaded: readonly IssueComment[] | undefined,
  embedded: { readonly total?: number; readonly comments: readonly unknown[] } | undefined,
) => loaded?.length ?? embedded?.total ?? embedded?.comments.length ?? 0;

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

export const commentLink = (siteUrl: string, issueKey: string, commentId: string) =>
  `${siteUrl}/browse/${issueKey}?focusedCommentId=${commentId}`;

const EDITED_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

export const editedNote = (comment: IssueComment): string | undefined => {
  if (!comment.updated || !(Date.parse(comment.updated) > Date.parse(comment.created))) return undefined;
  const when = new Date(comment.updated).toLocaleString("de-DE", EDITED_FORMAT);
  return comment.updateAuthor ? `Bearbeitet am ${when} von ${comment.updateAuthor.displayName}` : `Bearbeitet am ${when}`;
};

export type CommentEditPayload = { body: AdfNode; visibility?: CommentVisibility };

export const editPayload = (body: AdfNode, comment: IssueComment): CommentEditPayload => ({
  body,
  ...(!comment.parentId && comment.visibility && { visibility: comment.visibility }),
});

export const repliesKeptOnDelete = (thread: CommentThread, comment: IssueComment) =>
  thread.root.id === comment.id && !comment.parentId ? thread.replies.length : 0;

export const deleteReplyHint = (count: number): string | undefined => {
  if (count <= 0) return undefined;
  return count === 1
    ? "Die Antwort bleibt erhalten und steht danach als eigener Thread."
    : `Die ${count} Antworten bleiben erhalten und stehen danach als eigener Thread.`;
};
