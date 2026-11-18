import { Schema } from "effect";
import type { IssueHistory } from "./issue-history";

export const StatusIdentity = Schema.Struct({ id: Schema.optional(Schema.String), name: Schema.optional(Schema.String) });
export type StatusIdentity = typeof StatusIdentity.Type;
export type StatusTransition = { from: StatusIdentity; to: StatusIdentity };
export type StatusInterval = { key: string; start?: number; end?: number; kind: "closed" | "open" | "cut"; duration?: number; origin?: "creation" | "transition" };
export type StatusChoice = { key: string; id?: string; names: string[] };
type Event = StatusTransition & { at: number };

export const statusIdentityKey = (status: StatusIdentity) => status.id ? `id:${status.id}` : status.name ? `name:${status.name}` : undefined;

export const historyTimestamp = (raw: string | undefined): number | undefined => {
  const match = raw && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})$/.exec(raw);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second, zone] = match;
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return undefined;
  if (zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(-2)) > 59)) return undefined;
  const time = Date.parse(raw!);
  return Number.isFinite(time) ? time : undefined;
};

const sameId = (a: StatusIdentity, b: StatusIdentity) => !!a.id && a.id === b.id;

export function reconstructStatusIntervals({ history, current, created, asOf }: {
  history: IssueHistory; current: StatusIdentity; created?: string; asOf: string;
}) {
  const choices = new Map<string, StatusChoice>();
  const remember = (status: StatusIdentity) => {
    const key = statusIdentityKey(status);
    if (!key) return;
    const previous = choices.get(key) ?? { key, id: status.id, names: [] };
    if (status.name && !previous.names.includes(status.name)) previous.names.push(status.name);
    choices.set(key, previous);
  };
  const warnings = new Set<"coverage" | "invalid" | "simultaneous" | "chain" | "identity" | "current">();
  const events: Event[] = [];
  remember(current);
  const end = historyTimestamp(asOf);
  const birth = historyTimestamp(created);
  for (const entry of history.entries) {
    for (const transition of entry.statusTransitions ?? []) {
      remember(transition.from); remember(transition.to);
      const at = historyTimestamp(entry.created);
      if (at === undefined || end === undefined || at > end || (birth !== undefined && at < birth)) warnings.add("invalid");
      else events.push({ ...transition, at });
      if (!transition.from.id || !transition.to.id) warnings.add("identity");
    }
  }
  events.sort((a, b) => a.at - b.at);
  if (!history.coverage?.complete) warnings.add("coverage");
  if (!history.coverage?.contiguous) warnings.add("invalid");
  for (let index = 0; index < events.length; index++) {
    if (index > 0 && events[index - 1].at === events[index].at) warnings.add("simultaneous");
    if (index > 0 && !sameId(events[index - 1].to, events[index].from)) warnings.add("chain");
  }
  if (events.length && !sameId(events.at(-1)!.to, current)) warnings.add("current");
  if (!current.id) warnings.add("identity");
  const complete = warnings.size === 0 && birth !== undefined && end !== undefined && birth <= end;
  const intervals: StatusInterval[] = [];
  const add = (status: StatusIdentity, interval: Omit<StatusInterval, "key">) => {
    const key = statusIdentityKey(status);
    if (key) intervals.push({ key, ...interval });
  };
  if (end === undefined || (birth !== undefined && birth > end) || warnings.has("invalid")) {
    warnings.add("invalid");
    return { choices: [...choices.values()], intervals, complete: false, warnings: [...warnings], asOf };
  }
  let active: { status: StatusIdentity; start?: number; origin?: "creation" | "transition" } | undefined;
  const first = events[0]?.from ?? current;
  active = { status: first, start: complete ? birth : undefined, origin: complete ? "creation" : undefined };
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (events[index - 1]?.at === event.at || events[index + 1]?.at === event.at) {
      if (active) add(active.status, { start: active.start, kind: "cut", origin: active.origin });
      active = undefined;
      continue;
    }
    if (sameId(event.from, event.to)) {
      if (!active || !sameId(active.status, event.from)) {
        if (active) add(active.status, { start: active.start, kind: "cut", origin: active.origin });
        active = { status: event.to };
      }
      continue;
    }
    if (active && sameId(active.status, event.from)) {
      add(active.status, { start: active.start, end: event.at, kind: active.start === undefined ? "cut" : "closed", duration: active.start === undefined ? undefined : event.at - active.start, origin: active.origin });
    } else {
      if (active) add(active.status, { start: active.start, kind: "cut", origin: active.origin });
      add(event.from, { end: event.at, kind: "cut" });
    }
    active = { status: event.to, start: event.to.id ? event.at : undefined, origin: event.to.id ? "transition" : undefined };
  }
  if (active && sameId(active.status, current)) {
    add(active.status, { start: active.start, end, kind: active.start === undefined ? "cut" : "open", duration: active.start === undefined ? undefined : end - active.start, origin: active.origin });
  } else {
    if (active) add(active.status, { start: active.start, kind: "cut", origin: active.origin });
    add(current, { end, kind: "cut" });
  }
  return { choices: [...choices.values()], intervals, complete, warnings: [...warnings], asOf };
}

export const sumStatusIntervals = (intervals: readonly StatusInterval[], key: string) => {
  const selected = intervals.filter((interval) => interval.key === key);
  return {
    intervals: selected,
    closedMs: selected.reduce((sum, interval) => sum + (interval.kind === "closed" ? interval.duration ?? 0 : 0), 0),
    openMs: selected.find((interval) => interval.kind === "open")?.duration,
  };
};
