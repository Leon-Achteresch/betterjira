import { Data, Effect, Schema } from "effect";
import { jira } from "./client";
import { plainDescription } from "./adf-plain-text";
import { describeChanges, isNoiseChange } from "./notification-feed";
import { jiraKeys } from "./keys";
import { ACTIVITY_LOOKBACK_MS, ACTIVITY_OVERLAP_MS, StoredNotification } from "@/lib/notifications/inbox-state";

export type JiraNotification = typeof StoredNotification.Type;

export const notificationKey = (owner: string) => [...jiraKeys.all, "notifications", owner] as const;

const Actor = Schema.Struct({
  accountId: Schema.String,
  displayName: Schema.String,
  avatarUrls: Schema.Struct({ "48x48": Schema.String }),
});

const Comment = Schema.Struct({ id: Schema.String, created: Schema.String, author: Schema.optional(Schema.NullOr(Actor)), body: Schema.Unknown });
const History = Schema.Struct({
  id: Schema.String,
  created: Schema.String,
  author: Schema.optional(Schema.NullOr(Actor)),
  items: Schema.Array(Schema.Struct({
    field: Schema.String,
    fromString: Schema.optional(Schema.NullOr(Schema.String)),
    toString: Schema.optional(Schema.NullOr(Schema.String)),
    to: Schema.optional(Schema.NullOr(Schema.String)),
  })),
});
const CommentPage = Schema.Struct({ startAt: Schema.optional(Schema.Number), total: Schema.optional(Schema.Number), comments: Schema.Array(Comment) });
const HistoryPage = Schema.Struct({ startAt: Schema.optional(Schema.Number), total: Schema.optional(Schema.Number), values: Schema.Array(History) });
const ActivityPage = Schema.Struct({
  nextPageToken: Schema.optional(Schema.String),
  isLast: Schema.optional(Schema.Boolean),
  issues: Schema.Array(Schema.Struct({
    key: Schema.String,
    fields: Schema.Struct({
      summary: Schema.String,
      created: Schema.String,
      reporter: Schema.optional(Schema.NullOr(Actor)),
      assignee: Schema.optional(Schema.NullOr(Actor)),
      comment: Schema.optional(CommentPage),
    }),
    changelog: Schema.optional(Schema.Struct({ total: Schema.optional(Schema.Number), histories: Schema.Array(History) })),
  })),
});

const MentionNode = Schema.Struct({
  type: Schema.String,
  attrs: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  content: Schema.optional(Schema.Array(Schema.Unknown)),
});
const isMentionNode = Schema.is(MentionNode);
const mentions = (node: unknown, me: string): boolean =>
  isMentionNode(node) && ((node.type === "mention" && node.attrs?.id === me) || (node.content ?? []).some((child) => mentions(child, me)));

export class ActivityPagingError extends Data.TaggedError("ActivityPagingError")<{ message: string }> {}

const recentEntries = <T extends { created: string }, E>(
  total: number,
  after: number,
  fetchPage: (startAt: number, maxResults: number) => Effect.Effect<{ startAt?: number; entries: readonly T[] }, E>,
) => Effect.gen(function* () {
  const entries: T[] = [];
  let end = total;
  while (end > 0) {
    const start = Math.max(0, end - 50);
    let cursor = start;
    const window: T[] = [];
    while (cursor < end) {
      const page = yield* fetchPage(cursor, end - cursor);
      if ((page.startAt !== undefined && page.startAt !== cursor) || page.entries.length === 0) {
        return yield* new ActivityPagingError({ message: "Jira hat eine unvollständige Aktivitätsseite geliefert." });
      }
      const batch = page.entries.slice(0, end - cursor);
      window.push(...batch);
      cursor += batch.length;
    }
    entries.push(...window);
    if (window.some((entry) => Date.parse(entry.created) <= after)) break;
    end = start;
  }
  return entries;
});

const completeActivity = (issue: typeof ActivityPage.Type.issues[number], after: number) => Effect.gen(function* () {
  let comments = issue.fields.comment?.comments ?? [];
  let histories = issue.changelog?.histories ?? [];
  const commentTotal = issue.fields.comment?.total ?? comments.length;
  const historyTotal = issue.changelog?.total ?? histories.length;
  if (commentTotal > comments.length) {
    comments = yield* recentEntries(commentTotal, after, (startAt, maxResults) =>
      jira(`/issue/${encodeURIComponent(issue.key)}/comment?${new URLSearchParams({ startAt: String(startAt), maxResults: String(maxResults), orderBy: "created" })}`, CommentPage)
        .pipe(Effect.map((page) => ({ startAt: page.startAt, entries: page.comments }))));
  }
  if (historyTotal > histories.length) {
    histories = yield* recentEntries(historyTotal, after, (startAt, maxResults) =>
      jira(`/issue/${encodeURIComponent(issue.key)}/changelog?${new URLSearchParams({ startAt: String(startAt), maxResults: String(maxResults) })}`, HistoryPage)
        .pipe(Effect.map((page) => ({ startAt: page.startAt, entries: page.values }))));
  }
  return { ...issue, fields: { ...issue.fields, comment: { comments } }, changelog: { histories } };
});

const MAX_LOOKBACK_MINUTES = ACTIVITY_LOOKBACK_MS / 60_000;

const Probe = Schema.Struct({ issues: Schema.Array(Schema.Struct({ id: Schema.String })) });

export const fetchActivity = (me: string, since: number) =>
  Effect.gen(function* () {
    const minutes = Math.max(2, Math.min(Math.ceil((Date.now() - since) / 60_000) + 2, MAX_LOOKBACK_MINUTES));
    const jql = `(assignee = currentUser() OR reporter = currentUser() OR watcher = currentUser()) AND updated >= -${minutes}m ORDER BY updated DESC`;
    const probe = yield* jira(`/search/jql?${new URLSearchParams({ jql, fields: "updated", maxResults: "1" })}`, Probe);
    if (probe.issues.length === 0) return [];
    const params = new URLSearchParams({ jql, fields: "summary,created,reporter,assignee,comment", expand: "changelog", maxResults: "50" });
    const after = Math.max(since - ACTIVITY_OVERLAP_MS, Date.now() - ACTIVITY_LOOKBACK_MS);
    const issues = [];
    const tokens = new Set<string>();
    while (true) {
      const page = yield* jira(`/search/jql?${params}`, ActivityPage);
      issues.push(...(yield* Effect.forEach(page.issues, (issue) => completeActivity(issue, after), { concurrency: 4 })));
      if (page.isLast === true || (!page.nextPageToken && page.isLast !== false)) break;
      if (!page.nextPageToken || tokens.has(page.nextPageToken)) {
        return yield* new ActivityPagingError({ message: "Jira hat keine nächste Aktivitätsseite geliefert." });
      }
      tokens.add(page.nextPageToken);
      params.set("nextPageToken", page.nextPageToken);
    }
    const isNew = (created: string) => Date.parse(created) > after;
    return issues.flatMap((issue): JiraNotification[] => {
      const reporter = issue.fields.reporter;
      const involved = reporter?.accountId === me || issue.fields.assignee?.accountId === me;
      const base = { issueKey: issue.key, summary: issue.fields.summary, read: false, kind: involved ? ("direct" as const) : ("watching" as const) };
      const created =
        reporter && reporter.accountId !== me && isNew(issue.fields.created)
          ? [{ ...base, id: `${issue.key}:created`, title: "hat ein Ticket erstellt", body: issue.fields.summary, actor: reporter, created: Date.parse(issue.fields.created) }]
          : [];
      const changes = (issue.changelog?.histories ?? [])
        .filter((history) => history.author && history.author.accountId !== me && isNew(history.created) && !isNoiseChange(history.items))
        .map((history) => ({ ...base, ...describeChanges(history.items, me), id: `h:${history.id}`, actor: history.author!, created: Date.parse(history.created) }));
      const comments = (issue.fields.comment?.comments ?? [])
        .filter((comment) => comment.author && comment.author.accountId !== me && isNew(comment.created))
        .map((comment) => {
          const description = plainDescription(comment.body);
          const text = description.kind === "text" ? description.text : "";
          const mentioned = mentions(comment.body, me);
          return {
            ...base,
            id: `c:${comment.id}`,
            title: mentioned ? "hat dich in einem Kommentar erwähnt" : "hat einen Kommentar hinzugefügt",
            ...(mentioned && { kind: "direct" as const }),
            body: text.trim().slice(0, 240),
            actor: comment.author!,
            created: Date.parse(comment.created),
          };
        });
      return [...created, ...changes, ...comments];
    });
  });
