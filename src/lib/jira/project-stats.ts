import { Effect, Schema } from "effect";
import { addWeeks, differenceInCalendarDays, endOfMonth, format, startOfDay, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import { jira } from "./client";

const Person = Schema.Struct({ accountId: Schema.optional(Schema.String), displayName: Schema.String });

const StatsIssue = Schema.Struct({
  key: Schema.String,
  fields: Schema.Struct({
    summary: Schema.String,
    status: Schema.Struct({ name: Schema.String, statusCategory: Schema.Struct({ key: Schema.String }) }),
    assignee: Schema.optional(Schema.NullOr(Person)),
    reporter: Schema.optional(Schema.NullOr(Person)),
    created: Schema.String,
    updated: Schema.String,
    resolutiondate: Schema.optional(Schema.NullOr(Schema.String)),
    issuetype: Schema.Struct({ name: Schema.String }),
    priority: Schema.optional(Schema.NullOr(Schema.Struct({ name: Schema.String }))),
    labels: Schema.optional(Schema.Array(Schema.String)),
    components: Schema.optional(Schema.Array(Schema.Struct({ name: Schema.String }))),
    fixVersions: Schema.optional(Schema.Array(Schema.Struct({ name: Schema.String }))),
    duedate: Schema.optional(Schema.NullOr(Schema.String)),
    timespent: Schema.optional(Schema.NullOr(Schema.Number)),
    timeoriginalestimate: Schema.optional(Schema.NullOr(Schema.Number)),
  }),
});

export type StatsIssue = typeof StatsIssue.Type;

const StatsPage = Schema.Struct({
  issues: Schema.Array(StatsIssue),
  nextPageToken: Schema.optional(Schema.NullOr(Schema.String)),
});

const STATS_FIELDS =
  "summary,status,assignee,reporter,created,updated,resolutiondate,issuetype,priority,labels,components,fixVersions,duedate,timespent,timeoriginalestimate";

export const MAX_STATS_ISSUES = 3000;

export const fetchProjectStatsIssues = (projectKey: string) =>
  Effect.gen(function* () {
    const issues: StatsIssue[] = [];
    let pageToken: string | undefined;
    while (issues.length < MAX_STATS_ISSUES) {
      const params = new URLSearchParams({
        jql: `project = "${projectKey.replaceAll('"', '\\"')}" ORDER BY created DESC`,
        fields: STATS_FIELDS,
        maxResults: "100",
      });
      if (pageToken) params.set("nextPageToken", pageToken);
      const page = yield* jira(`/search/jql?${params}`, StatsPage);
      issues.push(...page.issues);
      pageToken = page.nextPageToken ?? undefined;
      if (!pageToken || page.issues.length === 0) return { issues, truncated: false };
    }
    return { issues, truncated: true };
  });

export const UNASSIGNED_LABEL = "Nicht zugewiesen";
const NONE_LABEL = "Ohne";

const SECONDS_PER_HOUR = 3600;
const STALE_DAYS = 30;
const RECENT_DAYS = 30;
const WEEKS = 26;
const MONTHS = 12;
const DUE_WEEKS = 8;
const TOP = 15;
const LIST = 20;
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const DAY_BUCKETS = [
  { name: "< 1 Tag", max: 1 },
  { name: "1–3 Tage", max: 3 },
  { name: "3–7 Tage", max: 7 },
  { name: "1–2 Wochen", max: 14 },
  { name: "2–4 Wochen", max: 30 },
  { name: "1–3 Monate", max: 90 },
  { name: "3–6 Monate", max: 180 },
  { name: "6–12 Monate", max: 365 },
  { name: "> 1 Jahr", max: Infinity },
];

type Category = "new" | "indeterminate" | "done";

const categoryOf = (issue: StatsIssue): Category => {
  const key = issue.fields.status.statusCategory.key;
  return key === "done" || key === "indeterminate" ? key : "new";
};

const days = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 86_400_000;

const resolvedAt = (issue: StatsIssue) => {
  const date = issue.fields.resolutiondate;
  return date ? new Date(date) : categoryOf(issue) === "done" ? new Date(issue.fields.updated) : undefined;
};

const leadTime = (issue: StatsIssue) => {
  const resolved = resolvedAt(issue);
  return resolved ? days(new Date(issue.fields.created), resolved) : undefined;
};

export const median = (values: readonly number[]) => {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

export const percentile = (values: readonly number[], p: number) => {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

const average = (values: readonly number[]) =>
  values.length === 0 ? undefined : values.reduce((sum, value) => sum + value, 0) / values.length;

const defined = <T>(value: T | undefined): value is T => value !== undefined;

export const countBy = <T>(items: readonly T[], keys: (item: T) => readonly string[]) => {
  const counts = new Map<string, number>();
  for (const item of items) for (const key of keys(item)) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

const bucketize = (values: readonly number[]) =>
  DAY_BUCKETS.map((bucket, index) => ({
    name: bucket.name,
    value: values.filter((value) => value < bucket.max && value >= (DAY_BUCKETS[index - 1]?.max ?? -Infinity)).length,
  }));

const hours = (seconds: number) => Math.round((seconds / SECONDS_PER_HOUR) * 10) / 10;

const isOverdue = (issue: StatsIssue, today: Date) =>
  categoryOf(issue) !== "done" && !!issue.fields.duedate && startOfDay(new Date(issue.fields.duedate)) < today;

const groupStats = (issues: readonly StatsIssue[], keyOf: (issue: StatsIssue) => string, today: Date) => {
  const groups = new Map<string, StatsIssue[]>();
  for (const issue of issues) {
    const key = keyOf(issue);
    const group = groups.get(key);
    if (group) group.push(issue);
    else groups.set(key, [issue]);
  }
  return [...groups]
    .map(([name, group]) => {
      const done = group.filter((issue) => categoryOf(issue) === "done");
      const resolvedRecently = done.filter((issue) => days(resolvedAt(issue)!, today) <= RECENT_DAYS);
      return {
        name,
        total: group.length,
        open: group.filter((issue) => categoryOf(issue) === "new").length,
        inProgress: group.filter((issue) => categoryOf(issue) === "indeterminate").length,
        done: done.length,
        doneRate: done.length / group.length,
        overdue: group.filter((issue) => isOverdue(issue, today)).length,
        resolvedRecently: resolvedRecently.length,
        medianLead: median(done.map(leadTime).filter(defined)),
        timeSpent: hours(group.reduce((sum, issue) => sum + (issue.fields.timespent ?? 0), 0)),
      };
    })
    .sort((a, b) => b.total - a.total);
};

export type GroupStats = ReturnType<typeof groupStats>[number];

const issueRef = (issue: StatsIssue, now: Date) => ({
  key: issue.key,
  summary: issue.fields.summary,
  status: issue.fields.status.name,
  assignee: issue.fields.assignee?.displayName ?? UNASSIGNED_LABEL,
  ageDays: Math.floor(days(new Date(issue.fields.created), now)),
  idleDays: Math.floor(days(new Date(issue.fields.updated), now)),
  duedate: issue.fields.duedate ?? undefined,
});

export type IssueRef = ReturnType<typeof issueRef>;

export const computeProjectStats = (issues: readonly StatsIssue[], now: Date) => {
  const today = startOfDay(now);
  const open = issues.filter((issue) => categoryOf(issue) !== "done");
  const done = issues.filter((issue) => categoryOf(issue) === "done");
  const leadTimes = done.map(leadTime).filter(defined);
  const openAges = open.map((issue) => days(new Date(issue.fields.created), now));
  const recent = (date: Date | undefined) => !!date && days(date, now) <= RECENT_DAYS;
  const createdRecently = issues.filter((issue) => recent(new Date(issue.fields.created))).length;
  const resolvedRecently = done.filter((issue) => recent(resolvedAt(issue))).length;
  const overdue = open.filter((issue) => isOverdue(issue, today));
  const stale = open.filter((issue) => days(new Date(issue.fields.updated), now) > STALE_DAYS);
  const timeSpent = issues.reduce((sum, issue) => sum + (issue.fields.timespent ?? 0), 0);
  const estimate = issues.reduce((sum, issue) => sum + (issue.fields.timeoriginalestimate ?? 0), 0);
  const estimatedDone = done.filter((issue) => issue.fields.timeoriginalestimate && issue.fields.timespent);

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekly = Array.from({ length: WEEKS }, (_, index) => {
    const start = subWeeks(weekStart, WEEKS - 1 - index);
    const end = addWeeks(start, 1);
    const within = (date: Date | undefined) => !!date && date >= start && date < end;
    return {
      name: format(start, "d. MMM", { locale: de }),
      created: issues.filter((issue) => within(new Date(issue.fields.created))).length,
      resolved: done.filter((issue) => within(resolvedAt(issue))).length,
    };
  });

  const monthly = Array.from({ length: MONTHS }, (_, index) => {
    const start = startOfMonth(subMonths(now, MONTHS - 1 - index));
    const end = endOfMonth(start);
    const within = (date: Date | undefined) => !!date && date >= start && date <= end;
    return {
      name: format(start, "MMM yy", { locale: de }),
      created: issues.filter((issue) => within(new Date(issue.fields.created))).length,
      resolved: done.filter((issue) => within(resolvedAt(issue))).length,
      backlog: issues.filter((issue) => {
        const resolved = resolvedAt(issue);
        return new Date(issue.fields.created) <= end && (!resolved || resolved > end);
      }).length,
    };
  });

  const weekdayIndex = (date: Date) => (date.getDay() + 6) % 7;
  const weekdays = WEEKDAYS.map((name, index) => ({
    name,
    created: issues.filter((issue) => weekdayIndex(new Date(issue.fields.created)) === index).length,
    resolved: done.filter((issue) => {
      const resolved = resolvedAt(issue);
      return !!resolved && weekdayIndex(resolved) === index;
    }).length,
  }));

  const hoursOfDay = Array.from({ length: 24 }, (_, hour) => ({
    name: `${hour}`,
    created: issues.filter((issue) => new Date(issue.fields.created).getHours() === hour).length,
    resolved: done.filter((issue) => resolvedAt(issue)?.getHours() === hour).length,
  }));

  const dueTimeline = Array.from({ length: DUE_WEEKS }, (_, index) => {
    const start = addWeeks(weekStart, index);
    const end = addWeeks(start, 1);
    return {
      name: format(start, "d. MMM", { locale: de }),
      value: open.filter((issue) => {
        const due = issue.fields.duedate ? new Date(issue.fields.duedate) : undefined;
        return !!due && due >= start && due < end;
      }).length,
    };
  });

  const statuses = countBy(issues, (issue) => [issue.fields.status.name]).map((entry) => ({
    ...entry,
    category: categoryOf(issues.find((issue) => issue.fields.status.name === entry.name)!),
  }));

  const ratios = estimatedDone.map((issue) => issue.fields.timespent! / issue.fields.timeoriginalestimate!);
  const sortedByDate = (list: StatsIssue[], date: (issue: StatsIssue) => string) =>
    [...list].sort((a, b) => date(a).localeCompare(date(b))).slice(0, LIST).map((issue) => issueRef(issue, now));

  return {
    total: issues.length,
    openCount: open.length,
    todoCount: issues.filter((issue) => categoryOf(issue) === "new").length,
    inProgressCount: issues.filter((issue) => categoryOf(issue) === "indeterminate").length,
    doneCount: done.length,
    doneRate: issues.length ? done.length / issues.length : 0,
    unassignedOpen: open.filter((issue) => !issue.fields.assignee).length,
    overdueCount: overdue.length,
    dueThisWeek: open.filter((issue) => {
      const due = issue.fields.duedate ? new Date(issue.fields.duedate) : undefined;
      return !!due && due >= today && differenceInCalendarDays(due, today) < 7;
    }).length,
    noDueDate: open.filter((issue) => !issue.fields.duedate).length,
    staleCount: stale.length,
    createdRecently,
    resolvedRecently,
    netFlow: createdRecently - resolvedRecently,
    avgLead: average(leadTimes),
    medianLead: median(leadTimes),
    p85Lead: percentile(leadTimes, 85),
    medianOpenAge: median(openAges),
    oldestOpenAge: openAges.length ? Math.max(...openAges) : undefined,
    throughputPerWeek: average(weekly.slice(-12).map((week) => week.resolved)),
    timeSpentHours: hours(timeSpent),
    estimateHours: hours(estimate),
    estimateAccuracy: median(ratios),
    contributors: new Set(issues.map((issue) => issue.fields.assignee?.displayName).filter(defined)).size,
    categories: [
      { name: "Offen", key: "todo", value: issues.filter((issue) => categoryOf(issue) === "new").length },
      { name: "In Arbeit", key: "progress", value: issues.filter((issue) => categoryOf(issue) === "indeterminate").length },
      { name: "Erledigt", key: "done", value: done.length },
    ],
    weekly,
    monthly,
    weekdays,
    hoursOfDay,
    dueTimeline,
    statuses,
    openStatuses: countBy(open, (issue) => [issue.fields.status.name]),
    types: groupStats(issues, (issue) => issue.fields.issuetype.name, today),
    priorities: groupStats(issues, (issue) => issue.fields.priority?.name ?? NONE_LABEL, today),
    assignees: groupStats(issues, (issue) => issue.fields.assignee?.displayName ?? UNASSIGNED_LABEL, today),
    reporters: countBy(issues, (issue) => [issue.fields.reporter?.displayName ?? NONE_LABEL]).slice(0, TOP),
    labels: countBy(issues, (issue) => issue.fields.labels ?? []).slice(0, TOP),
    components: countBy(issues, (issue) => issue.fields.components?.map((component) => component.name) ?? []).slice(0, TOP),
    versions: countBy(issues, (issue) => issue.fields.fixVersions?.map((version) => version.name) ?? []).slice(0, TOP),
    unlabeled: issues.filter((issue) => !issue.fields.labels?.length).length,
    leadBuckets: bucketize(leadTimes),
    ageBuckets: bucketize(openAges),
    overdueIssues: sortedByDate(overdue, (issue) => issue.fields.duedate!),
    oldestOpen: sortedByDate(open, (issue) => issue.fields.created),
    staleIssues: sortedByDate(stale, (issue) => issue.fields.updated),
  };
};

export type ProjectStats = ReturnType<typeof computeProjectStats>;
