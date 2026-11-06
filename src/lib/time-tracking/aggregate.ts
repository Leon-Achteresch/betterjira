import { isAdfDoc, adfToText } from "@/lib/jira/adf";
import type { CandidateIssue, Worklog } from "./client";
import { dayKey } from "./range";

export type IssueWorklogResult = { issue: CandidateIssue; worklogs: readonly Worklog[] };

export type TimeEntry = {
  id: string;
  issueKey: string;
  summary: string;
  started: number;
  seconds: number;
  comment: string;
};

export type TimeDay = { day: string; seconds: number; entries: TimeEntry[] };
export type TimeSummary = { days: TimeDay[]; seconds: number; entryCount: number; issueCount: number };

export const parseJiraTimestamp = (value: string) =>
  Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));

export const worklogComment = (comment: unknown) => {
  const text = isAdfDoc(comment) ? adfToText(comment) : typeof comment === "string" ? comment : "";
  return text.replace(/\s+/g, " ").trim();
};

export const aggregateWorklogs = ({
  accountId,
  start,
  end,
  days,
  results,
}: {
  accountId: string;
  start: Date;
  end: Date;
  days: readonly string[];
  results: readonly IssueWorklogResult[];
}): TimeSummary => {
  const seen = new Set<string>();
  const byDay = new Map<string, TimeEntry[]>(days.map((day) => [day, []]));
  const issues = new Set<string>();
  for (const { issue, worklogs } of results) {
    for (const worklog of worklogs) {
      if (worklog.author?.accountId !== accountId || seen.has(worklog.id)) continue;
      const started = parseJiraTimestamp(worklog.started);
      const seconds = worklog.timeSpentSeconds;
      if (!Number.isFinite(started) || started < start.getTime() || started >= end.getTime()) continue;
      if (!Number.isSafeInteger(seconds) || seconds <= 0) continue;
      const entries = byDay.get(dayKey(new Date(started)));
      if (!entries) continue;
      seen.add(worklog.id);
      issues.add(issue.key);
      entries.push({ id: worklog.id, issueKey: issue.key, summary: issue.summary, started, seconds, comment: worklogComment(worklog.comment) });
    }
  }
  const summary = days.map((day) => {
    const entries = (byDay.get(day) ?? []).sort((a, b) => a.started - b.started || a.id.localeCompare(b.id));
    return { day, entries, seconds: entries.reduce((total, entry) => total + entry.seconds, 0) };
  });
  return {
    days: summary,
    seconds: summary.reduce((total, day) => total + day.seconds, 0),
    entryCount: seen.size,
    issueCount: issues.size,
  };
};
