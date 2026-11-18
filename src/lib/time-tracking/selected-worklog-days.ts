import { format } from "date-fns";
import { normalizeDuration, validateWorklog } from "@/lib/jira/worklog";
import { parseJiraTimestamp } from "./aggregate";
import { parseDayKey } from "./range";

const LOCAL_MINUTE = "yyyy-MM-dd'T'HH:mm";
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MINUTE_MS = 60_000;

export type WorklogStartWindow = {
  total: number;
  worklogs: readonly { author?: { accountId?: string }; started: string }[];
};

export const selectedWorklogTime = (datetime: string) => {
  const time = datetime.split("T")[1];
  return time && TIME.test(time) ? time : "";
};

type LocalStart = { date: Date } | { problem: "invalid" | "ambiguous" };

const localStart = (day: string, time: string): LocalStart => {
  if (!parseDayKey(day) || !TIME.test(time)) return { problem: "invalid" };
  const requested = `${day}T${time}`;
  const date = new Date(requested);
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp) || format(date, LOCAL_MINUTE) !== requested) return { problem: "invalid" };

  const offset = date.getTimezoneOffset();
  const nearTransition = [-36, 36].some((hours) => {
    const otherOffset = new Date(timestamp + hours * 60 * MINUTE_MS).getTimezoneOffset();
    const alternate = timestamp + (otherOffset - offset) * MINUTE_MS;
    return alternate !== timestamp && format(new Date(alternate), LOCAL_MINUTE) === requested;
  });
  return nearTransition ? { problem: "ambiguous" } : { date };
};

export const selectedWorklogDayError = (day: string, days: readonly string[]) => {
  if (!parseDayKey(day)) return "Wähle ein gültiges Datum.";
  if (days.includes(day)) return "Dieser Tag ist bereits ausgewählt.";
};

type PlannedWorklogDay = {
  day: string;
  time: string;
  duration: string;
  dateTime?: string;
  offset?: string;
  problem?: string;
};

export const planSelectedWorklogDays = (
  { days, time, duration, accountId, loaded }: {
    days: readonly string[];
    time: string;
    duration: string;
    accountId: string;
    loaded?: WorklogStartWindow;
  },
  now = Date.now(),
) => {
  const normalized = normalizeDuration(duration);
  if (!normalized) return { error: "Gib eine Dauer wie 30m oder 1h 30m ein." };
  if (!TIME.test(time)) return { error: "Gib eine gültige lokale Startzeit ein." };
  if (!days.length) return { error: "Wähle mindestens einen einzelnen Tag aus." };
  if (new Set(days).size !== days.length) return { error: "Jeder Tag kann nur einmal ausgewählt werden." };

  const occupied = new Set<number>();
  let partial = !loaded || loaded.total !== loaded.worklogs.length;
  for (const entry of loaded?.worklogs ?? []) {
    if (!entry.author?.accountId) {
      partial = true;
      continue;
    }
    if (entry.author.accountId !== accountId) continue;
    const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(entry.started) ? parseJiraTimestamp(entry.started) : NaN;
    if (!Number.isFinite(timestamp)) partial = true;
    else occupied.add(Math.floor(timestamp / MINUTE_MS));
  }

  const rows = [...days].sort().map((day): PlannedWorklogDay => {
    const common = { day, time, duration: normalized };
    const start = localStart(day, time);
    if ("problem" in start) return {
      ...common,
      problem: start.problem === "ambiguous" ? "Diese lokale Uhrzeit kommt an diesem Tag zweimal vor."
        : "Diese lokale Uhrzeit ist an diesem Tag ungültig.",
    };
    const dateTime = format(start.date, "yyyy-MM-dd'T'HH:mmxxx");
    const problem = validateWorklog(normalized, dateTime, now)
      ?? (occupied.has(Math.floor(start.date.getTime() / MINUTE_MS)) ? "Eigene Buchung mit diesem Beginn vorhanden." : undefined);
    return { ...common, dateTime, offset: format(start.date, "xxx"), problem };
  });
  return { rows, partial };
};
