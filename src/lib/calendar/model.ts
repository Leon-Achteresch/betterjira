import { Schema } from "effect";

export const LinkedIssue = Schema.Struct({ key: Schema.String, summary: Schema.String });
export type LinkedIssue = typeof LinkedIssue.Type;

export const Rollout = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  start: Schema.String,
  end: Schema.String,
  notes: Schema.String,
  issues: Schema.Array(LinkedIssue),
  siteUrl: Schema.String,
  reminderMinutes: Schema.Number,
  outlookEventId: Schema.NullOr(Schema.String),
  outlookAccountId: Schema.NullOr(Schema.String),
  outlookWebLink: Schema.NullOr(Schema.String),
});
export type Rollout = typeof Rollout.Type;
export const Rollouts = Schema.Array(Rollout);

export const RolloutDraft = Schema.Struct({
  title: Schema.String,
  start: Schema.String,
  end: Schema.String,
  notes: Schema.String,
  issues: Schema.Array(LinkedIssue),
  siteUrl: Schema.String,
  reminderMinutes: Schema.Number,
});
export type RolloutDraft = typeof RolloutDraft.Type;

export const OutlookAccount = Schema.Struct({ id: Schema.String, displayName: Schema.String, email: Schema.String });
export type OutlookAccount = typeof OutlookAccount.Type;

export const OutlookCalendarEvent = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  start: Schema.String,
  end: Schema.String,
  webLink: Schema.String,
  isAllDay: Schema.Boolean,
});
export type OutlookCalendarEvent = typeof OutlookCalendarEvent.Type;

export const calendarKeys = {
  all: ["calendar"] as const,
  rollouts: ["calendar", "rollouts"] as const,
  account: ["calendar", "outlook-account"] as const,
  events: (start: string, end: string) => ["calendar", "outlook-events", start, end] as const,
  issues: (siteUrl: string, query: string) => ["calendar", "issues", siteUrl, query] as const,
};
