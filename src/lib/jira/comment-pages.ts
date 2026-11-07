import { Effect, Schema } from "effect";
import { jira } from "./client";
import { IssueComment, jiraKeys } from "./queries";

export const COMMENT_PAGE_SIZE = 50;

const CommentPageResponse = Schema.Struct({
  startAt: Schema.optional(Schema.Number),
  maxResults: Schema.optional(Schema.Number),
  total: Schema.optional(Schema.Number),
  comments: Schema.Array(IssueComment),
});

export type JiraComment = typeof IssueComment.Type;

export type CommentPage = typeof CommentPageResponse.Type & { requestedAt: number };

export type CommentThread = {
  comments: JiraComment[];
  loaded: number;
  total?: number;
  next?: number;
  incomplete: boolean;
};

const count = (value: number | undefined) =>
  value !== undefined && Number.isInteger(value) && value >= 0 ? value : undefined;

export const nextCommentPosition = (page: CommentPage): number | undefined => {
  if (page.comments.length === 0) return undefined;
  const next = (count(page.startAt) ?? page.requestedAt) + page.comments.length;
  if (next <= page.requestedAt) return undefined;
  const total = count(page.total);
  if (total !== undefined) return next < total ? next : undefined;
  const limit = count(page.maxResults);
  return limit !== undefined && page.comments.length < limit ? undefined : next;
};

export const initialCommentPosition = (first: CommentPage) =>
  (count(first.startAt) ?? 0) > 0 ? 0 : nextCommentPosition(first);

export const summarizeCommentThread = (first: CommentPage, pages: readonly CommentPage[]): CommentThread => {
  const byId = new Map<string, JiraComment>();
  for (const page of [first, ...pages])
    for (const comment of page.comments) if (!byId.has(comment.id)) byId.set(comment.id, comment);
  const last = pages.at(-1);
  const reported = [...pages, first].reverse().map((page) => count(page.total)).find((total) => total !== undefined);
  const loaded = byId.size;
  const total = reported === undefined ? undefined : Math.max(reported, loaded);
  const next = last ? nextCommentPosition(last) : initialCommentPosition(first);
  return {
    comments: [...byId.values()],
    loaded,
    total,
    next,
    incomplete: next === undefined && total !== undefined && loaded < total,
  };
};

export const commentProgressLabel = ({ loaded, total, next, incomplete }: CommentThread) => {
  const known = total === undefined ? `${loaded} Kommentare geladen · Gesamtzahl unbekannt` : `${loaded} von ${total} Kommentaren geladen`;
  if (incomplete) return `${known} · Jira liefert keine weiteren`;
  if (next !== undefined || total === undefined) return known;
  return `Alle ${total} Kommentare geladen`;
};

export const commentPageKeys = {
  issue: (cloudId: string, accountId: string, key: string) =>
    [...jiraKeys.issue(key), "comment-pages", cloudId, accountId] as const,
};

export const fetchCommentPage = (key: string, startAt: number) =>
  jira(
    `/issue/${encodeURIComponent(key)}/comment?${new URLSearchParams({
      startAt: String(startAt),
      maxResults: String(COMMENT_PAGE_SIZE),
      orderBy: "created",
    })}`,
    CommentPageResponse,
  ).pipe(Effect.map((page): CommentPage => ({ ...page, requestedAt: startAt })));
