import { Effect, Schema } from "effect";
import { jira } from "./client";
import { RawComment, toIssueComment, type IssueComment } from "./comment-thread";
import { jiraKeys } from "./keys";

export const COMMENT_PAGE_SIZE = 50;

const CommentPageResponse = Schema.Struct({
  startAt: Schema.optional(Schema.Number),
  maxResults: Schema.optional(Schema.Number),
  total: Schema.optional(Schema.Number),
  comments: Schema.optional(Schema.Array(RawComment)),
});

export type JiraComment = IssueComment;

export type CommentPage = Omit<typeof CommentPageResponse.Type, "comments"> & { comments: readonly JiraComment[]; requestedAt: number };

export type LoadedComments = {
  comments: JiraComment[];
  loaded: number;
  total?: number;
  next?: number;
  incomplete: boolean;
  /** Ids only known from the embedded detail response: no page and no own post confirmed their parentId. */
  embeddedOnly: ReadonlySet<string>;
};

const count = (value: number | undefined) =>
  value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

export const nextCommentPosition = (page: CommentPage): number | undefined => {
  if (page.comments.length === 0) return undefined;
  const next = (count(page.startAt) ?? page.requestedAt) + page.comments.length;
  if (!Number.isSafeInteger(next) || next <= page.requestedAt) return undefined;
  const total = count(page.total);
  if (total !== undefined && total >= next) return next < total ? next : undefined;
  return next;
};

export const initialCommentPosition = (first: CommentPage) =>
  (count(first.startAt) ?? 0) > 0 || (first.comments.length === 0 && count(first.total) === undefined) ? 0 : nextCommentPosition(first);

export const summarizeCommentPages = (
  first: CommentPage,
  pages: readonly CommentPage[],
  posted: readonly JiraComment[] = [],
): LoadedComments => {
  // Precedence: embedded detail < own posted comment < /comment pages; only the latter two carry parentId.
  const byId = new Map<string, JiraComment>();
  for (const comment of first.comments) if (!byId.has(comment.id)) byId.set(comment.id, comment);
  const confirmed = new Set<string>();
  for (const comment of posted) {
    confirmed.add(comment.id);
    byId.set(comment.id, comment);
  }
  const fetched = new Set<string>();
  for (const page of pages)
    for (const comment of page.comments)
      if (!fetched.has(comment.id)) {
        fetched.add(comment.id);
        confirmed.add(comment.id);
        byId.set(comment.id, comment);
      }
  const embeddedOnly = new Set([...byId.keys()].filter((id) => !confirmed.has(id)));
  const last = pages.at(-1);
  const reported = [first, ...pages].reduce<number | undefined>((known, page) => {
    const total = count(page.total);
    return total === undefined ? known : Math.max(known ?? 0, total);
  }, undefined);
  const loaded = byId.size;
  const total = reported === undefined ? undefined : Math.max(reported, loaded);
  const next = last ? nextCommentPosition({ ...last, total: reported }) : initialCommentPosition(first);
  return {
    comments: [...byId.values()],
    loaded,
    total,
    next,
    incomplete: next === undefined && total !== undefined && loaded < total,
    embeddedOnly,
  };
};

export const withPostedComment = (posted: readonly JiraComment[] | undefined, comment: JiraComment): JiraComment[] => [
  ...(posted ?? []).filter(({ id }) => id !== comment.id),
  comment,
];

export const withoutPostedComment = (posted: readonly JiraComment[] | undefined, id: string): JiraComment[] =>
  (posted ?? []).filter((comment) => comment.id !== id);

export const withEditedPostedComment = (
  posted: readonly JiraComment[] | undefined,
  id: string,
  body: unknown,
  updated: string,
): JiraComment[] => (posted ?? []).map((comment) => (comment.id === id ? { ...comment, body, updated } : comment));

export const commentProgressLabel = ({ loaded, total, next, incomplete }: Omit<LoadedComments, "embeddedOnly">) => {
  const known = total === undefined ? `${loaded} Kommentare geladen · Gesamtzahl unbekannt` : `${loaded} von ${total} Kommentaren geladen`;
  if (incomplete) return `${known} · Jira liefert keine weiteren`;
  if (total === undefined && next === undefined) return `${known} · Jira liefert keine weiteren`;
  if (next !== undefined || total === undefined || loaded < total) return known;
  return `Alle ${total} Kommentare geladen`;
};

export const commentPageKeys = {
  issue: (cloudId: string, accountId: string, key: string) =>
    [...jiraKeys.issue(key), "comment-pages", cloudId, accountId] as const,
  posted: (cloudId: string, accountId: string, key: string) => ["jira", "comment-posted", key, cloudId, accountId] as const,
};

export const fetchCommentPage = (key: string, startAt: number) =>
  jira(
    `/issue/${encodeURIComponent(key)}/comment?${new URLSearchParams({
      startAt: String(startAt),
      maxResults: String(COMMENT_PAGE_SIZE),
      orderBy: "created",
    })}`,
    CommentPageResponse,
  ).pipe(
    Effect.map((page): CommentPage => ({ ...page, comments: (page.comments ?? []).map(toIssueComment), requestedAt: startAt })),
  );
