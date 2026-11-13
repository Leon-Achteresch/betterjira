import { Option, Schema } from "effect";
import { retainInboxItems, validSnoozes, wakeSnoozed } from "./snooze";

export const StoredNotification = Schema.Struct({
  id: Schema.String,
  issueKey: Schema.String,
  summary: Schema.String,
  created: Schema.Number,
  read: Schema.Boolean,
  kind: Schema.Literals(["direct", "watching"]),
  title: Schema.String,
  body: Schema.String,
  actor: Schema.Struct({ displayName: Schema.String, avatarUrls: Schema.Struct({ "48x48": Schema.String }) }),
});

export const MAX_NOTIFICATION_ITEMS = 200;
export const ACTIVITY_LOOKBACK_MS = 3 * 24 * 60 * 60_000;
export const ACTIVITY_OVERLAP_MS = 60_000;

const StoredInbox = Schema.Struct({
  owner: Schema.optional(Schema.NullOr(Schema.String)),
  checkedAt: Schema.optional(Schema.NullOr(Schema.Number)),
  items: Schema.optional(Schema.Array(Schema.Unknown)),
  seen: Schema.optional(Schema.Record(Schema.String, Schema.Number)),
  snoozed: Schema.optional(Schema.Unknown),
});
const decodeInbox = Schema.decodeUnknownOption(StoredInbox);
const decodeItem = Schema.decodeUnknownOption(StoredNotification);

export const restoreInbox = (raw: unknown, now = Date.now()) => {
  const state = Option.getOrUndefined(decodeInbox(raw));
  const checkedAt = state?.checkedAt !== undefined && state.checkedAt !== null && Number.isFinite(state.checkedAt) ? state.checkedAt : null;
  const seen = Object.fromEntries(Object.entries(state?.seen ?? {}).filter(([, time]) => Number.isFinite(time) && time >= (checkedAt ?? 0) - ACTIVITY_LOOKBACK_MS));
  const items = new Map<string, typeof StoredNotification.Type>();
  for (const rawItem of state?.items ?? []) {
    const legacy = typeof rawItem === "object" && rawItem !== null ? { kind: "watching", ...rawItem } : rawItem;
    const item = Option.getOrUndefined(decodeItem(legacy));
    if (!item || !Number.isFinite(item.created)) continue;
    const previous = items.get(item.id);
    items.set(item.id, { ...item, read: item.read || previous?.read === true });
    seen[item.id] = item.created;
  }
  const snoozed = validSnoozes(state?.snoozed ?? {}, new Set([...items.values()].map((item) => item.issueKey)));
  const restored = wakeSnoozed(retainInboxItems([...items.values()], snoozed, MAX_NOTIFICATION_ITEMS), snoozed, now);
  return {
    owner: state?.owner ?? null,
    checkedAt,
    seen,
    items: restored.items,
    snoozed: restored.snoozed,
  };
};
