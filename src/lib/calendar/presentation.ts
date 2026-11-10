import {
  addMinutes,
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { quoteJql } from "@/lib/jira/jql";
import type { LinkedIssue, OutlookAccount, OutlookCalendarEvent, Rollout, RolloutDraft } from "./model";
import { ROLLOUT_TITLE_MAX_LENGTH } from "./validation";

export const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

export const REMINDER_OPTIONS = [
  { value: 0, label: "Keine Erinnerung" },
  { value: 5, label: "5 Minuten vorher" },
  { value: 15, label: "15 Minuten vorher" },
  { value: 30, label: "30 Minuten vorher" },
  { value: 60, label: "1 Stunde vorher" },
  { value: 1440, label: "1 Tag vorher" },
] as const;

export const DEFAULT_REMINDER_MINUTES = 15;
export const DEFAULT_DURATION_MINUTES = 60;
export const ISSUE_SEARCH_LIMIT = 20;

const ISSUE_KEY = /^[a-z][a-z0-9_]*-\d+$/i;
const WEEK = { weekStartsOn: 1 } as const;

export const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

export const monthTitle = (month: Date) => format(month, "LLLL yyyy", { locale: de });

export const dayTitle = (day: Date) => format(day, "EEEE, d. MMMM", { locale: de });

export const monthGrid = (month: Date) =>
  eachDayOfInterval({ start: startOfWeek(startOfMonth(month), WEEK), end: endOfWeek(endOfMonth(month), WEEK) });

export const gridRange = (month: Date) => {
  const days = monthGrid(month);
  return { start: startOfDay(days[0]).toISOString(), end: addDays(startOfDay(days[days.length - 1]), 1).toISOString() };
};

type Timed = { readonly start: string; readonly end: string };

const interval = (item: Timed) => {
  const start = parseISO(item.start);
  const end = parseISO(item.end);
  return { start, end: end > start ? end : start };
};

export const occursOn = (item: Timed, day: Date) =>
  parseISO(item.start) < addDays(startOfDay(day), 1) && parseISO(item.end) > startOfDay(day);

const byStart = <T extends Timed>(a: T, b: T) => Date.parse(a.start) - Date.parse(b.start);

export const itemsOn = <T extends Timed>(items: readonly T[], day: Date) => items.filter((item) => occursOn(item, day)).sort(byStart);

export const externalEvents = (events: readonly OutlookCalendarEvent[], rollouts: readonly Rollout[]) => {
  const linked = new Set(rollouts.map((rollout) => rollout.outlookEventId));
  return events.filter((event) => !linked.has(event.id));
};

export const upcomingRollouts =(rollouts: readonly Rollout[], now: Date, limit = 5) =>
  rollouts
    .filter((rollout) => parseISO(rollout.end) >= now)
    .sort(byStart)
    .slice(0, limit);

const time = (date: Date) => format(date, "HH:mm");

export const timeRange = (item: Timed, day?: Date) => {
  const { start, end } = interval(item);
  if (isSameDay(start, end)) return `${time(start)} – ${time(end)}`;
  if (day && isSameDay(day, start)) return `ab ${time(start)}`;
  if (day && isSameDay(day, end)) return `bis ${time(end)}`;
  if (day) return "ganztägig";
  return `${format(start, "d. MMM HH:mm", { locale: de })} – ${format(end, "d. MMM HH:mm", { locale: de })}`;
};

export const eventTimeRange = (event: OutlookCalendarEvent, day?: Date) => (event.isAllDay ? "ganztägig" : timeRange(event, day));

export const shortDate = (iso: string) => format(parseISO(iso), "EEE, d. MMM", { locale: de });

export const reminderLabel = (minutes: number) =>
  REMINDER_OPTIONS.find((option) => option.value === minutes)?.label ?? `${minutes} Minuten vorher`;

export type RolloutForm = {
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  notes: string;
  issues: readonly LinkedIssue[];
  reminderMinutes: number;
};

export type RolloutFormErrors = Partial<Record<"title" | "start" | "end", string>>;

const formParts = (date: Date) => ({ date: format(date, "yyyy-MM-dd"), time: format(date, "HH:mm") });

export const emptyRolloutForm = (day: Date, now: Date): RolloutForm => {
  const base = isSameDay(day, now) ? now : day;
  const start = new Date(base);
  start.setHours(isSameDay(day, now) ? now.getHours() + 1 : 9, 0, 0, 0);
  const end = addMinutes(start, DEFAULT_DURATION_MINUTES);
  const s = formParts(start);
  const e = formParts(end);
  return { title: "", startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time, notes: "", issues: [], reminderMinutes: DEFAULT_REMINDER_MINUTES };
};

export const rolloutForm = (rollout: Rollout): RolloutForm => {
  const s = formParts(parseISO(rollout.start));
  const e = formParts(parseISO(rollout.end));
  return {
    title: rollout.title,
    startDate: s.date,
    startTime: s.time,
    endDate: e.date,
    endTime: e.time,
    notes: rollout.notes,
    issues: rollout.issues,
    reminderMinutes: rollout.reminderMinutes,
  };
};

export const localInstant = (date: string, clock: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(clock)) return null;
  const value = new Date(`${date}T${clock}`);
  return isValid(value) && format(value, "yyyy-MM-dd'T'HH:mm") === `${date}T${clock}` ? value : null;
};

export const validateRolloutForm = (form: RolloutForm): RolloutFormErrors => {
  const start = localInstant(form.startDate, form.startTime);
  const end = localInstant(form.endDate, form.endTime);
  return {
    ...(!form.title.trim() && { title: "Bitte einen Titel angeben." }),
    ...(form.title.trim().length > ROLLOUT_TITLE_MAX_LENGTH && { title: `Der Titel darf höchstens ${ROLLOUT_TITLE_MAX_LENGTH} Zeichen enthalten.` }),
    ...(!start && { start: "Bitte Datum und Uhrzeit für den Beginn angeben." }),
    ...(!end && { end: "Bitte Datum und Uhrzeit für das Ende angeben." }),
    ...(start && end && end <= start && { end: "Das Ende muss nach dem Beginn liegen." }),
  };
};

export const hasErrors = (errors: RolloutFormErrors) => Object.keys(errors).length > 0;

export const shiftEnd = (form: RolloutForm, startDate: string, startTime: string): RolloutForm => {
  const previousStart = localInstant(form.startDate, form.startTime);
  const previousEnd = localInstant(form.endDate, form.endTime);
  const nextStart = localInstant(startDate, startTime);
  if (!previousStart || !previousEnd || !nextStart) return { ...form, startDate, startTime };
  const end = formParts(new Date(nextStart.getTime() + (previousEnd.getTime() - previousStart.getTime())));
  return { ...form, startDate, startTime, endDate: end.date, endTime: end.time };
};

export const rolloutDraft = (form: RolloutForm, siteUrl: string): RolloutDraft | null => {
  const start = localInstant(form.startDate, form.startTime);
  const end = localInstant(form.endDate, form.endTime);
  if (hasErrors(validateRolloutForm(form)) || !start || !end) return null;
  return {
    title: form.title.trim(),
    start: start.toISOString(),
    end: end.toISOString(),
    notes: form.notes.trim(),
    issues: form.issues,
    siteUrl,
    reminderMinutes: form.reminderMinutes,
  };
};

export const toggleIssue = (issues: readonly LinkedIssue[], issue: LinkedIssue) =>
  issues.some((linked) => linked.key === issue.key) ? issues.filter((linked) => linked.key !== issue.key) : [...issues, issue];

export const issueSearchJql = (query: string) => {
  const term = query.trim();
  if (!term) return "issue in issueHistory() ORDER BY lastViewed DESC";
  if (ISSUE_KEY.test(term)) return `key = ${quoteJql(term.toUpperCase())}`;
  return `text ~ ${quoteJql(`${term}*`)} ORDER BY updated DESC`;
};

export const issueSummary = (fields: Readonly<Record<string, unknown>>) =>
  typeof fields.summary === "string" ? fields.summary : "";

export type OutlookLinkState = "local" | "linked" | "disconnected" | "other-account";

export const outlookLinkState = (rollout: Rollout, account: OutlookAccount | null | undefined): OutlookLinkState => {
  if (!rollout.outlookEventId) return "local";
  if (!account) return "disconnected";
  return rollout.outlookAccountId === account.id ? "linked" : "other-account";
};

export const OUTLOOK_LINK_LABELS: Record<OutlookLinkState, string> = {
  local: "Nur lokal",
  linked: "In Outlook eingetragen",
  disconnected: "Outlook nicht verbunden",
  "other-account": "Anderer Outlook-Kalender",
};

export const canSyncRollout = (state: OutlookLinkState) => state === "local" || state === "linked";

export const issueBrowseUrl = (siteUrl: string, key: string) => `${siteUrl.replace(/\/+$/, "")}/browse/${key}`;

export const opensInternally = (rolloutSiteUrl: string, currentSiteUrl: string | undefined) =>
  !!currentSiteUrl && (!rolloutSiteUrl || rolloutSiteUrl === currentSiteUrl);

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;
