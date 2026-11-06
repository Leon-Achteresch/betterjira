export const INSIGHT_DIMENSIONS = {
  status: "Status",
  priority: "Priorität",
  assignee: "Bearbeiter",
  issuetype: "Typ",
  label: "Label",
} as const;

export const INSIGHT_MEASURES = { count: "Anzahl Vorgänge", points: "Story Points" } as const;

export const NO_SEGMENT = "none";

export type InsightDimension = keyof typeof INSIGHT_DIMENSIONS;
export type InsightMeasure = keyof typeof INSIGHT_MEASURES;
export type InsightSegment = InsightDimension | typeof NO_SEGMENT;

export type InsightItem = { values: Record<InsightDimension, readonly string[]>; points?: number };

export type InsightRow = { name: string; total: number; segments: number[] };

export type Insights = { total: number; segments: string[]; rows: InsightRow[] };

export const EMPTY_VALUES: Record<InsightDimension, string> = {
  status: "Ohne Status",
  priority: "Ohne Priorität",
  assignee: "Nicht zugewiesen",
  issuetype: "Ohne Typ",
  label: "Ohne Label",
};

const PRIORITIES: [RegExp, number, string][] = [
  [/blocker|highest|critical|kritisch|höchst/i, 0, "var(--destructive)"],
  [/lowest|trivial|niedrigst/i, 4, "var(--muted-foreground)"],
  [/high|hoch|major/i, 1, "var(--warning)"],
  [/low|niedrig|minor/i, 3, "var(--chart-2)"],
  [/medium|mittel|normal/i, 2, "var(--chart-1)"],
];

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const priority = (name: string) => PRIORITIES.find(([pattern]) => pattern.test(name));

export const priorityRank = (name: string) => priority(name)?.[1] ?? 5;

export const labelColor = (label: string) =>
  PALETTE[[...label].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7) % PALETTE.length]!;

export const insightColor = (dimension: InsightSegment, value: string, index: number) => {
  if (Object.values(EMPTY_VALUES).includes(value)) return "var(--muted-foreground)";
  if (dimension === "priority") return priority(value)?.[2] ?? "var(--muted-foreground)";
  if (dimension === "label") return labelColor(value);
  return PALETTE[index % PALETTE.length]!;
};

const valuesOf = (item: InsightItem, dimension: InsightDimension) =>
  item.values[dimension].length > 0 ? item.values[dimension] : [EMPTY_VALUES[dimension]];

const ordered = (totals: Map<string, number>, dimension: InsightDimension, order: readonly string[] = []) =>
  [...totals.keys()].sort((a, b) => {
    const empty = Number(a === EMPTY_VALUES[dimension]) - Number(b === EMPTY_VALUES[dimension]);
    if (empty) return empty;
    const known = (order.includes(a) ? order.indexOf(a) : Infinity) - (order.includes(b) ? order.indexOf(b) : Infinity);
    if (known) return known;
    if (dimension === "priority") return priorityRank(a) - priorityRank(b);
    return totals.get(b)! - totals.get(a)! || a.localeCompare(b, "de");
  });

export function boardInsights(
  items: readonly InsightItem[],
  measure: InsightMeasure,
  slice: InsightDimension,
  segment: InsightSegment,
  order: Partial<Record<InsightDimension, readonly string[]>> = {},
): Insights {
  const amount = (item: InsightItem) => (measure === "points" ? (item.points ?? 0) : 1);
  const sliceTotals = new Map<string, number>();
  const segmentTotals = new Map<string, number>();
  for (const item of items) {
    for (const value of valuesOf(item, slice)) sliceTotals.set(value, (sliceTotals.get(value) ?? 0) + amount(item));
    if (segment !== NO_SEGMENT)
      for (const value of valuesOf(item, segment)) segmentTotals.set(value, (segmentTotals.get(value) ?? 0) + amount(item));
  }
  const segments = segment === NO_SEGMENT ? [] : ordered(segmentTotals, segment, order[segment]);
  const rows = ordered(sliceTotals, slice, order[slice]).map((name) => {
    const matching = items.filter((item) => valuesOf(item, slice).includes(name));
    return {
      name,
      total: sliceTotals.get(name)!,
      segments: segments.map((value) =>
        matching.reduce((sum, item) => sum + (segment !== NO_SEGMENT && valuesOf(item, segment).includes(value) ? amount(item) : 0), 0),
      ),
    };
  });
  return { total: items.reduce((sum, item) => sum + amount(item), 0), segments, rows };
}
