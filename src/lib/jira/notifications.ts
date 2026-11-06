import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { Effect, Schema } from "effect";
import { toast } from "sonner";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jira } from "./client";
import { commentIdOfNotification, describeChanges, type FeedItem } from "./notification-feed";

export type JiraNotification = FeedItem & {
  title: string;
  body: string;
  actor: { displayName: string; avatarUrls: { "48x48": string } };
};

type NotificationState = {
  items: JiraNotification[];
  checkedAt: number | null;
  receive: (items: JiraNotification[], checkedAt: number) => JiraNotification[];
  setRead: (ids: string[], read: boolean) => void;
  markAllRead: () => void;
  clear: () => void;
};

const MAX_ITEMS = 200;

export const useNotifications = create<NotificationState>()(
  persist(
    (set, get) => ({
      items: [],
      checkedAt: null,
      receive: (incoming, checkedAt) => {
        const known = new Set(get().items.map((item) => item.id));
        const fresh = incoming.filter((item) => !known.has(item.id));
        set(({ items }) => ({
          checkedAt,
          items: [...fresh, ...items].sort((a, b) => b.created - a.created).slice(0, MAX_ITEMS),
        }));
        return fresh;
      },
      setRead: (ids, read) => set(({ items }) => ({ items: items.map((item) => (ids.includes(item.id) ? { ...item, read } : item)) })),
      markAllRead: () => set(({ items }) => ({ items: items.map((item) => ({ ...item, read: true })) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "betterjira-notifications",
      version: 1,
      migrate: (persisted) => {
        const state = persisted as { items?: Array<Partial<JiraNotification>>; checkedAt?: number | null };
        return { ...state, items: (state.items ?? []).map((item) => ({ kind: "watching", ...item })) } as NotificationState;
      },
    },
  ),
);

export const selectUnread = (state: NotificationState) => state.items.reduce((count, item) => count + (item.read ? 0 : 1), 0);

const Actor = Schema.Struct({
  accountId: Schema.String,
  displayName: Schema.String,
  avatarUrls: Schema.Struct({ "48x48": Schema.String }),
});

const ActivityPage = Schema.Struct({
  issues: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      fields: Schema.Struct({
        summary: Schema.String,
        created: Schema.String,
        reporter: Schema.optional(Schema.NullOr(Actor)),
        assignee: Schema.optional(Schema.NullOr(Actor)),
        comment: Schema.optional(
          Schema.Struct({
            comments: Schema.Array(
              Schema.Struct({ id: Schema.String, created: Schema.String, author: Schema.optional(Actor), body: Schema.Unknown }),
            ),
          }),
        ),
      }),
      changelog: Schema.optional(
        Schema.Struct({
          histories: Schema.Array(
            Schema.Struct({
              id: Schema.String,
              created: Schema.String,
              author: Schema.optional(Actor),
              items: Schema.Array(
                Schema.Struct({
                  field: Schema.String,
                  fromString: Schema.optional(Schema.NullOr(Schema.String)),
                  toString: Schema.optional(Schema.NullOr(Schema.String)),
                  to: Schema.optional(Schema.NullOr(Schema.String)),
                }),
              ),
            }),
          ),
        }),
      ),
    }),
  ),
});

const adfText = (node: unknown, me: string): { text: string; mentioned: boolean } => {
  if (!node || typeof node !== "object") return { text: "", mentioned: false };
  const { type, text, attrs, content } = node as { type?: string; text?: string; attrs?: { id?: string; text?: string }; content?: unknown[] };
  if (type === "mention") return { text: attrs?.text ?? "", mentioned: attrs?.id === me };
  const children = (content ?? []).map((child) => adfText(child, me));
  const separator = type === "doc" ? " " : "";
  return {
    text: (text ?? "") + children.map((child) => child.text).join(separator),
    mentioned: children.some((child) => child.mentioned),
  };
};

const BASE_INTERVAL = 30_000;
const MAX_INTERVAL = 5 * 60_000;
let quietPolls = 0;

export const pollInterval = () => (document.hasFocus() ? BASE_INTERVAL : Math.min(BASE_INTERVAL * 2 ** quietPolls, MAX_INTERVAL));

export const recordPoll = (freshCount: number) => {
  quietPolls = freshCount > 0 ? 0 : quietPolls + 1;
};

const MAX_LOOKBACK_MINUTES = 3 * 24 * 60;
const CLOCK_SKEW_MS = 60_000;

const Probe = Schema.Struct({ issues: Schema.Array(Schema.Struct({ id: Schema.String })) });

export const fetchActivity = (me: string, since: number) =>
  Effect.gen(function* () {
    const minutes = Math.min(Math.ceil((Date.now() - since) / 60_000) + 2, MAX_LOOKBACK_MINUTES);
    const jql = `(assignee = currentUser() OR reporter = currentUser() OR watcher = currentUser()) AND updated >= -${minutes}m ORDER BY updated DESC`;
    const probe = yield* jira(`/search/jql?${new URLSearchParams({ jql, fields: "updated", maxResults: "1" })}`, Probe);
    if (probe.issues.length === 0) return [];
    const params = new URLSearchParams({ jql, fields: "summary,created,reporter,assignee,comment", expand: "changelog", maxResults: "50" });
    const { issues } = yield* jira(`/search/jql?${params}`, ActivityPage);
    const after = since - CLOCK_SKEW_MS;
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
        .filter((history) => history.author && history.author.accountId !== me && isNew(history.created))
        .map((history) => ({ ...base, ...describeChanges(history.items, me), id: `h:${history.id}`, actor: history.author!, created: Date.parse(history.created) }));
      const comments = (issue.fields.comment?.comments ?? [])
        .filter((comment) => comment.author && comment.author.accountId !== me && isNew(comment.created))
        .map((comment) => {
          const { text, mentioned } = adfText(comment.body, me);
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

const MAX_NATIVE = 3;

const notifyNative = async (fresh: JiraNotification[]) => {
  const granted = (await isPermissionGranted()) || (await requestPermission()) === "granted";
  if (!granted) return;
  const shown = fresh.slice(0, MAX_NATIVE);
  for (const item of shown) {
    sendNotification({ title: `${item.issueKey} · ${item.actor.displayName}`, body: `${item.title}: ${item.body}` });
  }
  if (fresh.length > shown.length) {
    sendNotification({ title: "betterjira", body: `${fresh.length - shown.length} weitere Benachrichtigungen` });
  }
};

export const openNotification = (item: JiraNotification, openIssue: (key: string, commentId?: string) => void) => {
  const { items, setRead } = useNotifications.getState();
  setRead(items.filter((entry) => entry.issueKey === item.issueKey).map((entry) => entry.id), true);
  openIssue(item.issueKey, commentIdOfNotification(item.id));
};

export const deliver = (fresh: JiraNotification[], openIssue: (key: string, commentId?: string) => void) => {
  if (fresh.length === 0) return;
  if (!document.hasFocus()) return void notifyNative(fresh).catch(() => undefined);
  for (const item of fresh.slice(0, MAX_NATIVE)) {
    toast(`${item.issueKey} · ${item.actor.displayName} ${item.title}`, {
      description: item.body,
      action: { label: "Öffnen", onClick: () => openNotification(item, openIssue) },
    });
  }
};
