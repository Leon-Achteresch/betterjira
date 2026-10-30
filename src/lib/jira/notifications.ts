import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { Effect, Schema } from "effect";
import { toast } from "sonner";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jira } from "./client";
import { jiraKeys, useJiraMyself, useJiraSite } from "./queries";

export type JiraNotification = {
  id: string;
  issueKey: string;
  summary: string;
  title: string;
  body: string;
  actor: { displayName: string; avatarUrls: { "48x48": string } };
  created: number;
  read: boolean;
};

type NotificationState = {
  items: JiraNotification[];
  checkedAt: number | null;
  receive: (items: JiraNotification[], checkedAt: number) => JiraNotification[];
  markRead: (id: string) => void;
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
      markRead: (id) => set(({ items }) => ({ items: items.map((item) => (item.id === id ? { ...item, read: true } : item)) })),
      markAllRead: () => set(({ items }) => ({ items: items.map((item) => ({ ...item, read: true })) })),
      clear: () => set({ items: [] }),
    }),
    { name: "betterjira-notifications" },
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

const describeChanges = (items: ReadonlyArray<{ field: string; fromString?: string | null; toString?: string | null }>) => {
  const status = items.find((item) => item.field === "status");
  if (status) return { title: "hat den Status geändert", body: `${status.fromString ?? "–"} → ${status.toString ?? "–"}` };
  const assignee = items.find((item) => item.field === "assignee");
  if (assignee) return { title: "hat die Zuweisung geändert", body: assignee.toString ? `Zugewiesen an ${assignee.toString}` : "Zuweisung entfernt" };
  return { title: "hat das Ticket bearbeitet", body: [...new Set(items.map((item) => item.field))].join(", ") };
};

const BASE_INTERVAL = 30_000;
const MAX_INTERVAL = 5 * 60_000;
let quietPolls = 0;

const pollInterval = () => (document.hasFocus() ? BASE_INTERVAL : Math.min(BASE_INTERVAL * 2 ** quietPolls, MAX_INTERVAL));

const MAX_LOOKBACK_MINUTES = 3 * 24 * 60;
const CLOCK_SKEW_MS = 60_000;

const Probe = Schema.Struct({ issues: Schema.Array(Schema.Struct({ id: Schema.String })) });

const fetchActivity = (me: string, since: number) =>
  Effect.gen(function* () {
    const minutes = Math.min(Math.ceil((Date.now() - since) / 60_000) + 2, MAX_LOOKBACK_MINUTES);
    const jql = `(assignee = currentUser() OR reporter = currentUser() OR watcher = currentUser()) AND updated >= -${minutes}m ORDER BY updated DESC`;
    const probe = yield* jira(`/search/jql?${new URLSearchParams({ jql, fields: "updated", maxResults: "1" })}`, Probe);
    if (probe.issues.length === 0) return [];
    const params = new URLSearchParams({ jql, fields: "summary,created,reporter,comment", expand: "changelog", maxResults: "50" });
    const { issues } = yield* jira(`/search/jql?${params}`, ActivityPage);
    const after = since - CLOCK_SKEW_MS;
    const isNew = (created: string) => Date.parse(created) > after;
    return issues.flatMap((issue): JiraNotification[] => {
      const base = { issueKey: issue.key, summary: issue.fields.summary, read: false };
      const reporter = issue.fields.reporter;
      const created =
        reporter && reporter.accountId !== me && isNew(issue.fields.created)
          ? [{ ...base, id: `${issue.key}:created`, title: "hat ein Ticket erstellt", body: issue.fields.summary, actor: reporter, created: Date.parse(issue.fields.created) }]
          : [];
      const changes = (issue.changelog?.histories ?? [])
        .filter((history) => history.author && history.author.accountId !== me && isNew(history.created))
        .map((history) => ({ ...base, ...describeChanges(history.items), id: `h:${history.id}`, actor: history.author!, created: Date.parse(history.created) }));
      const comments = (issue.fields.comment?.comments ?? [])
        .filter((comment) => comment.author && comment.author.accountId !== me && isNew(comment.created))
        .map((comment) => {
          const { text, mentioned } = adfText(comment.body, me);
          return {
            ...base,
            id: `c:${comment.id}`,
            title: mentioned ? "hat dich erwähnt" : "hat kommentiert",
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

export const openNotification = (siteUrl: string, item: JiraNotification) => {
  useNotifications.getState().markRead(item.id);
  void openUrl(`${siteUrl}/browse/${item.issueKey}`);
};

const deliver = (fresh: JiraNotification[], siteUrl: string) => {
  if (fresh.length === 0) return;
  if (!document.hasFocus()) return void notifyNative(fresh).catch(() => undefined);
  for (const item of fresh.slice(0, MAX_NATIVE)) {
    toast(`${item.issueKey} · ${item.actor.displayName} ${item.title}`, {
      description: item.body,
      action: { label: "Öffnen", onClick: () => openNotification(siteUrl, item) },
    });
  }
};

export const useNotificationPoller = () => {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const me = myself.data?.accountId;
  const siteUrl = site.data?.siteUrl;

  useQuery({
    queryKey: [...jiraKeys.all, "notifications", me],
    queryFn: async ({ signal }) => {
      const startedAt = Date.now();
      const { checkedAt, receive } = useNotifications.getState();
      if (checkedAt === null) {
        receive([], startedAt);
        return startedAt;
      }
      const activity = await Effect.runPromise(fetchActivity(me!, checkedAt), { signal });
      const fresh = receive(activity, startedAt);
      quietPolls = fresh.length > 0 ? 0 : quietPolls + 1;
      deliver(fresh, siteUrl!);
      return startedAt;
    },
    enabled: !!me && !!siteUrl,
    refetchInterval: pollInterval,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    staleTime: 0,
    gcTime: 0,
  });

  const unread = useNotifications(selectUnread);
  useEffect(() => {
    void getCurrentWindow().setBadgeCount(unread || undefined).catch(() => undefined);
  }, [unread]);
};
