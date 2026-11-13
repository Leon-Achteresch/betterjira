import { Schema } from "effect";
import { type BoardFilter, type BoardView } from "@/lib/board-filters";
import { DEFAULT_HIDDEN_PROPERTIES, type CardProperty } from "@/lib/board-display";
import { type InsightDimension, type InsightMeasure, type InsightSegment } from "@/lib/board-insights";
import { DEFAULT_VIEW, type IssueView } from "@/lib/jira/issue-view";
import { IssueGrouping } from "@/lib/jira/issue-grouping";

const isRecord = Schema.is(Schema.Record(Schema.String, Schema.Unknown));
const Strings = Schema.mutable(Schema.Array(Schema.String));
const isStrings = Schema.is(Strings);
const BooleanMap = Schema.Record(Schema.String, Schema.Boolean);
const Filter = Schema.Struct({ assignee: Schema.optional(Strings), issuetype: Schema.optional(Strings), priority: Schema.optional(Strings), label: Schema.optional(Strings) });
const BoardViewSchema = Schema.Struct({ name: Schema.String, filters: Schema.Record(Schema.String, Filter), ignoreBoard: BooleanMap });
export const IssueViewSchema = Schema.Struct({
  columns: Strings,
  sort: Schema.mutable(Schema.Array(Schema.Struct({ field: Schema.String, direction: Schema.Literals(["ASC", "DESC"]) }))),
  quick: Schema.mutable(Schema.Array(Schema.Literals(["mine", "unassigned", "open", "recent", "overdue", "reported", "watching"]))),
  facets: Schema.Struct({ status: Schema.optional(Strings), issuetype: Schema.optional(Strings), priority: Schema.optional(Strings), assignee: Schema.optional(Strings), labels: Schema.optional(Strings) }),
  dense: Schema.Boolean,
  groupBy: Schema.optional(IssueGrouping),
  collapsedGroups: Schema.optional(Strings),
});
const isIssueView = Schema.is(IssueViewSchema);
const isFilter = Schema.is(Filter);

function readMap<T>(value: unknown, valid: (entry: unknown) => entry is T, normalize: (entry: T) => T = (entry) => entry): Record<string, T> {
  return isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, T] => valid(entry[1])).map(([key, entry]) => [key, normalize(entry)])) : {};
}

const normalizeFilter = Schema.decodeUnknownSync(Filter);
const normalizeBoardView = Schema.decodeUnknownSync(BoardViewSchema);
const normalizeIssueView = Schema.decodeUnknownSync(IssueViewSchema);
const SavedViews = Schema.mutable(Schema.Array(Schema.Struct({ ...IssueViewSchema.fields, name: Schema.String })));

export function readBoardFilters(persisted: unknown): {
  filters: Record<string, BoardFilter>;
  ignoreBoard: Record<string, boolean>;
  views: Record<string, BoardView[]>;
  hiddenColumns: Record<string, string[]>;
} {
  if (!isRecord(persisted)) return { filters: {}, ignoreBoard: {}, views: {}, hiddenColumns: {} };
  return {
    filters: readMap(persisted.filters, isFilter, normalizeFilter),
    ignoreBoard: readMap(persisted.ignoreBoard, (entry): entry is boolean => typeof entry === "boolean"),
    views: readMap(persisted.views, Schema.is(Schema.mutable(Schema.Array(BoardViewSchema))), (views) => views.map((view) => normalizeBoardView(view))),
    hiddenColumns: readMap(persisted.hiddenColumns, isStrings),
  };
}

export function readIssueViews(persisted: unknown): { views: Record<string, IssueView>; saved: Record<string, (IssueView & { name: string })[]> } {
  if (!isRecord(persisted)) return { views: {}, saved: {} };
  const views = isRecord(persisted.views)
    ? Object.fromEntries(Object.entries(persisted.views).flatMap(([key, value]) => {
      const candidate = isRecord(value) ? { ...DEFAULT_VIEW, ...value } : undefined;
      return isIssueView(candidate) && candidate.columns.length > 0 ? [[key, normalizeIssueView(candidate)]] : [];
    }))
    : {};
  const saved = readMap(persisted.saved, Schema.is(SavedViews), Schema.decodeUnknownSync(SavedViews));
  return { views, saved };
}

export const legacyIssuePresentation = (view: Partial<IssueView> | undefined): Partial<IssueView> =>
  view ? { columns: view.columns ?? DEFAULT_VIEW.columns, dense: view.dense ?? DEFAULT_VIEW.dense } : {};

const BoardDisplay = Schema.Struct({
  insightsOpen: Schema.Boolean,
  measure: Schema.Literals(["count", "points"]),
  slice: Schema.Literals(["status", "priority", "assignee", "issuetype", "label"]),
  segment: Schema.Literals(["status", "priority", "assignee", "issuetype", "label", "none"]),
  hiddenProperties: Schema.Array(Schema.Literals(["priority", "issuetype", "labels", "parent", "points", "subtasks", "duedate", "age", "rank", "assignee"])),
});

export function readBoardDisplay(persisted: unknown): {
  insightsOpen: boolean; measure: InsightMeasure; slice: InsightDimension; segment: InsightSegment; hiddenProperties: CardProperty[];
} {
  return Schema.is(BoardDisplay)(persisted)
    ? { insightsOpen: persisted.insightsOpen, measure: persisted.measure, slice: persisted.slice, segment: persisted.segment, hiddenProperties: [...persisted.hiddenProperties] }
    : { insightsOpen: false, measure: "count", slice: "status", segment: "priority", hiddenProperties: DEFAULT_HIDDEN_PROPERTIES };
}

export const boardPreferencePrefix = (account: string) => `${JSON.stringify(account)}:`;

export const scopedBoardPreferences = <T>(values: Record<string, T>, account: string | null): Record<string, T> => {
  if (account === null) return {};
  const prefix = boardPreferencePrefix(account);
  return Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), value]));
};

export const scopedBoardView = (view: BoardView, account: string | null): BoardView => ({
  name: view.name,
  filters: scopedBoardPreferences(view.filters, account),
  ignoreBoard: scopedBoardPreferences(view.ignoreBoard, account),
});

