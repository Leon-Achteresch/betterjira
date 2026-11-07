import { addDays, addWeeks, format, isValid, parse, startOfDay, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { queryOf } from "@/lib/search/search-params";

export type TimeRangeKind = "tag" | "woche";
export type TimeRangeSearch = { zeitraum?: TimeRangeKind; datum?: string; q?: string };
export type TimeRange = { kind: TimeRangeKind; start: Date; end: Date; days: string[] };
export type TimeRangePreset = "heute" | "woche" | "vorwoche";

const DAY_FORMAT = "yyyy-MM-dd";
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export const TIME_RANGE_PRESETS: readonly { id: TimeRangePreset; label: string }[] = [
  { id: "heute", label: "Heute" },
  { id: "woche", label: "Diese Woche" },
  { id: "vorwoche", label: "Letzte Woche" },
];

export const dayKey = (date: Date) => format(date, DAY_FORMAT);

export const parseDayKey = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = parse(value, DAY_FORMAT, new Date());
  return isValid(date) && dayKey(date) === value ? date : undefined;
};

export const timeRangeSearch = (search: Record<string, unknown>): TimeRangeSearch => ({
  ...(search.zeitraum === "tag" && { zeitraum: "tag" }),
  ...(parseDayKey(search.datum) && { datum: String(search.datum) }),
  q: queryOf(search.q),
});

export const resolveTimeRange = (search: TimeRangeSearch, today: Date): TimeRange => {
  const kind = search.zeitraum ?? "woche";
  const anchor = parseDayKey(search.datum) ?? startOfDay(today);
  const start = kind === "tag" ? startOfDay(anchor) : startOfWeek(anchor, WEEK_OPTIONS);
  const length = kind === "tag" ? 1 : 7;
  const days = Array.from({ length }, (_, index) => dayKey(addDays(start, index)));
  return { kind, start, end: addDays(start, length), days };
};

export const shiftTimeRange = (range: TimeRange, direction: 1 | -1): TimeRangeSearch => {
  const next = range.kind === "tag" ? addDays(range.start, direction) : addWeeks(range.start, direction);
  return { ...(range.kind === "tag" && { zeitraum: "tag" }), datum: dayKey(next) };
};

export const presetSearch = (preset: TimeRangePreset, today: Date): TimeRangeSearch => {
  if (preset === "heute") return { zeitraum: "tag" };
  if (preset === "woche") return {};
  return { datum: dayKey(startOfWeek(addWeeks(today, -1), WEEK_OPTIONS)) };
};

export const activePreset = (range: TimeRange, today: Date): TimeRangePreset | undefined =>
  TIME_RANGE_PRESETS.map(({ id }) => id).find((id) => {
    const preset = resolveTimeRange(presetSearch(id, today), today);
    return preset.kind === range.kind && preset.days[0] === range.days[0];
  });

export const timeRangeLabel = (range: TimeRange) => {
  if (range.kind === "tag") return format(range.start, "EEEE, d. MMMM yyyy", { locale: de });
  return `${format(range.start, "d. MMM", { locale: de })} – ${format(addDays(range.end, -1), "d. MMM yyyy", { locale: de })}`;
};

export const dayLabel = (key: string) => format(parse(key, DAY_FORMAT, new Date()), "EEEE, d. MMMM", { locale: de });
