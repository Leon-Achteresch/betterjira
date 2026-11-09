import { differenceInCalendarDays, format, isSameDay, isWeekend, parseISO } from "date-fns";

export type AgendaTone = "urgent" | "normal";

export type AgendaTarget = "inbox" | "calendar" | "time" | "tickets" | "issue";

export type AgendaItem = {
  id: string;
  tone: AgendaTone;
  title: string;
  detail: string;
  action: string;
  target: AgendaTarget;
  issueKey?: string;
};

type AgendaIssue = { key: string; fields: { summary: string; updated: string; duedate?: string | null } };

export type AgendaInput = {
  now: Date;
  directUnread: number;
  rollouts: readonly { title: string; start: string }[];
  loggedSeconds: number | null;
  active: readonly AgendaIssue[];
  open: readonly AgendaIssue[];
};

export const STALE_AFTER_DAYS = 5;
const TIME_REMINDER_HOUR = 15;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const hours = (seconds: number) => (seconds / 3600).toLocaleString("de", { maximumFractionDigits: 1 });

const inboxItem = (unread: number): AgendaItem[] =>
  unread > 0
    ? [
        {
          id: "inbox",
          tone: "urgent",
          title: plural(unread, "Rückmeldung an dich", "Rückmeldungen an dich"),
          detail: "Erwähnungen, Zuweisungen und Kommentare in deinen Tickets",
          action: "Lesen",
          target: "inbox",
        },
      ]
    : [];

const dueItems = (open: readonly AgendaIssue[], now: Date): AgendaItem[] => {
  const due = open
    .filter((issue) => issue.fields.duedate && differenceInCalendarDays(parseISO(issue.fields.duedate), now) <= 0)
    .sort((a, b) => a.fields.duedate!.localeCompare(b.fields.duedate!));
  const [first] = due;
  if (!first) return [];
  const overdue = differenceInCalendarDays(parseISO(first.fields.duedate!), now) < 0;
  return [
    {
      id: "due",
      tone: "urgent",
      title: due.length === 1 ? `${first.key} ist ${overdue ? "überfällig" : "heute fällig"}` : `${due.length} Tickets fällig oder überfällig`,
      detail: due.length === 1 ? first.fields.summary : due.map((issue) => issue.key).slice(0, 4).join(", "),
      action: "Öffnen",
      target: "issue",
      issueKey: first.key,
    },
  ];
};

const rolloutItems = (rollouts: AgendaInput["rollouts"], now: Date): AgendaItem[] => {
  const today = rollouts
    .filter((rollout) => isSameDay(new Date(rollout.start), now))
    .sort((a, b) => a.start.localeCompare(b.start));
  const [first] = today;
  if (!first) return [];
  return [
    {
      id: "rollout",
      tone: "normal",
      title: today.length === 1 ? `Rollout um ${format(new Date(first.start), "HH:mm")}` : `${today.length} Rollouts heute`,
      detail: today.length === 1 ? first.title : `Als Erstes um ${format(new Date(first.start), "HH:mm")}: ${first.title}`,
      action: "Kalender",
      target: "calendar",
    },
  ];
};

const staleItems = (active: readonly AgendaIssue[], now: Date): AgendaItem[] => {
  const stale = active.filter((issue) => differenceInCalendarDays(now, new Date(issue.fields.updated)) >= STALE_AFTER_DAYS);
  const [first] = stale;
  if (!first) return [];
  return [
    {
      id: "stale",
      tone: "normal",
      title: stale.length === 1 ? `${first.key} liegt seit ${STALE_AFTER_DAYS}+ Tagen` : `${stale.length} Tickets ohne Bewegung`,
      detail: stale.length === 1 ? first.fields.summary : `In Arbeit, aber seit ${STALE_AFTER_DAYS}+ Tagen unverändert. Status noch aktuell?`,
      action: "Prüfen",
      ...(stale.length === 1 ? { target: "issue" as const, issueKey: first.key } : { target: "tickets" as const }),
    },
  ];
};

const timeItem = (loggedSeconds: number | null, now: Date): AgendaItem[] => {
  if (loggedSeconds === null || isWeekend(now)) return [];
  const late = now.getHours() >= TIME_REMINDER_HOUR;
  if (loggedSeconds > 0) {
    return [{ id: "time", tone: "normal", title: `${hours(loggedSeconds)} h heute gebucht`, detail: "Fehlt noch etwas?", action: "Zeit buchen", target: "time" }];
  }
  return [
    {
      id: "time",
      tone: late ? "urgent" : "normal",
      title: "Noch keine Zeit gebucht",
      detail: late ? "Der Tag ist fast vorbei" : "Buch deine Zeit am besten direkt mit",
      action: "Zeit buchen",
      target: "time",
    },
  ];
};

export const todayAgenda = (input: AgendaInput): AgendaItem[] => {
  const items = [
    ...inboxItem(input.directUnread),
    ...dueItems(input.open, input.now),
    ...rolloutItems(input.rollouts, input.now),
    ...staleItems(input.active, input.now),
    ...timeItem(input.loggedSeconds, input.now),
  ];
  return [...items.filter((item) => item.tone === "urgent"), ...items.filter((item) => item.tone !== "urgent")];
};
