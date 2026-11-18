import { Schema } from "effect";
import { formatSeconds } from "../time-tracking/presentation";

const JiraTimeTracking = Schema.Struct({
  originalEstimate: Schema.optional(Schema.NullOr(Schema.String)),
  remainingEstimate: Schema.optional(Schema.NullOr(Schema.String)),
  timeSpent: Schema.optional(Schema.NullOr(Schema.String)),
  originalEstimateSeconds: Schema.optional(Schema.Unknown),
  remainingEstimateSeconds: Schema.optional(Schema.Unknown),
  timeSpentSeconds: Schema.optional(Schema.Unknown),
});

export const ISSUE_TIME_FIELDS = {
  timetracking: Schema.optional(Schema.NullOr(JiraTimeTracking)),
  timeoriginalestimate: Schema.optional(Schema.Unknown),
  timeestimate: Schema.optional(Schema.Unknown),
  timespent: Schema.optional(Schema.Unknown),
  aggregatetimeoriginalestimate: Schema.optional(Schema.Unknown),
  aggregatetimeestimate: Schema.optional(Schema.Unknown),
  aggregatetimespent: Schema.optional(Schema.Unknown),
};

const Seconds = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }));
const METRICS = [
  { key: "estimate", label: "Geschätzt", own: "timeoriginalestimate", aggregate: "aggregatetimeoriginalestimate", seconds: "originalEstimateSeconds", text: "originalEstimate" },
  { key: "spent", label: "Erfasst", own: "timespent", aggregate: "aggregatetimespent", seconds: "timeSpentSeconds", text: "timeSpent" },
  { key: "remaining", label: "Verbleibend", own: "timeestimate", aggregate: "aggregatetimeestimate", seconds: "remainingEstimateSeconds", text: "remainingEstimate" },
] as const;

export type IssueTimeValue = { text: string; source: string; state: "known" | "formatted" | "missing" | "invalid"; seconds?: number; note?: string };

const numericValue = (value: unknown, source: string): IssueTimeValue => Schema.is(Seconds)(value)
  ? { text: formatSeconds(value), seconds: value, source, state: "known" }
  : { text: "Unbekannt", source, state: value == null ? "missing" : "invalid", note: value == null ? "Nicht geliefert" : "Ungültiger Jira-Wert" };

export const issueTimeSummary = (fields: Readonly<Record<string, unknown>>) => {
  const tracking = Schema.is(JiraTimeTracking)(fields.timetracking) ? fields.timetracking : undefined;
  return METRICS.map((metric) => {
    const ownSeconds = fields[metric.own] ?? tracking?.[metric.seconds];
    const ownSource = fields[metric.own] == null ? `timetracking.${metric.seconds}` : metric.own;
    const formatted = tracking?.[metric.text];
    const own: IssueTimeValue = ownSeconds == null && formatted?.trim()
      ? { text: formatted, source: `timetracking.${metric.text}`, state: "formatted", note: "Jira-Textangabe" }
      : numericValue(ownSeconds, ownSource);
    return { key: metric.key, label: metric.label, own, aggregate: numericValue(fields[metric.aggregate], metric.aggregate) };
  });
};

export type IssueTimeSummary = ReturnType<typeof issueTimeSummary>;
