import { Effect, Schema } from "effect";
import type { AdfNode } from "./adf";
import { jira, jiraSend } from "./client";
import { COMMENT_PAGE_SIZE, CommentPage, RawComment, collectCommentPages, replyPayload, toIssueComment } from "./comment-thread";
import { toPeople } from "./people";

const MENTION_SEARCH_RESULTS = "20";

const SearchResult = Schema.Array(Schema.Unknown);

const commentPath = (key: string) => `/issue/${encodeURIComponent(key)}/comment`;

export const commentList = (key: string) =>
  collectCommentPages((startAt) =>
    jira(
      `${commentPath(key)}?${new URLSearchParams({ orderBy: "created", startAt: String(startAt), maxResults: String(COMMENT_PAGE_SIZE) })}`,
      CommentPage,
    ),
  );

export const postComment = (key: string, body: AdfNode) =>
  jiraSend(commentPath(key), { method: "POST", body: JSON.stringify({ body }) });

export const postReply = (key: string, body: AdfNode, threadKey: string) =>
  jira(commentPath(key), RawComment, { method: "POST", body: JSON.stringify(replyPayload(body, threadKey)) }).pipe(
    Effect.map(toIssueComment),
  );

export const mentionSearch = (issueKey: string, query: string) =>
  jira(`/user/viewissue/search?${new URLSearchParams({ issueKey, query, maxResults: MENTION_SEARCH_RESULTS })}`, SearchResult).pipe(
    Effect.map(toPeople),
  );
