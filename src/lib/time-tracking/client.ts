import { addDays } from "date-fns";
import { Effect, Option, Schema, Semaphore } from "effect";
import { jira } from "@/lib/jira/client";
import { searchIssues } from "@/lib/jira/search";
import { dayKey } from "./range";

export const MAX_CANDIDATE_ISSUES = 100;
export const WORKLOG_PAGE_SIZE = 100;
export const MAX_WORKLOG_PAGES = 5;
export const WORKLOG_CONCURRENCY = 4;

const CANDIDATE_PAGE_SIZE = 50;
const worklogLimit = Semaphore.makeUnsafe(WORKLOG_CONCURRENCY);

export const Worklog = Schema.Struct({
  id: Schema.String,
  author: Schema.optional(Schema.Struct({ accountId: Schema.String })),
  started: Schema.String,
  timeSpentSeconds: Schema.Number,
  comment: Schema.optional(Schema.Unknown),
});

export type Worklog = typeof Worklog.Type;

const WorklogPage = Schema.Struct({
  startAt: Schema.Number,
  total: Schema.Number,
  worklogs: Schema.Array(Worklog),
});

const CandidateFields = Schema.Struct({ summary: Schema.String });

export type CandidateIssue = { id: string; key: string; summary: string };
export type CandidateIssues = { issues: CandidateIssue[]; truncated: boolean };
export type IssueWorklogs = { worklogs: Worklog[]; truncated: boolean };

export const candidateJql = (start: Date, end: Date) =>
  `worklogAuthor = currentUser() AND worklogDate >= "${dayKey(addDays(start, -1))}" AND worklogDate <= "${dayKey(end)}" ORDER BY updated DESC`;

export const fetchCandidateIssues = (start: Date, end: Date) =>
  Effect.gen(function* () {
    const jql = candidateJql(start, end);
    const issues: CandidateIssue[] = [];
    let pageToken: string | undefined;
    while (true) {
      const page = yield* searchIssues(jql, ["summary"], pageToken, CANDIDATE_PAGE_SIZE);
      for (const issue of page.issues) {
        const fields = Schema.decodeUnknownOption(CandidateFields)(issue.fields);
        issues.push({ id: issue.id, key: issue.key, summary: Option.match(fields, { onNone: () => "", onSome: (value) => value.summary }) });
      }
      const more = !page.isLast && !!page.nextPageToken;
      if (!more) return { issues, truncated: false };
      if (issues.length >= MAX_CANDIDATE_ISSUES) return { issues: issues.slice(0, MAX_CANDIDATE_ISSUES), truncated: true };
      pageToken = page.nextPageToken ?? undefined;
    }
  });

export const fetchIssueWorklogs = (issueId: string, start: Date, end: Date) =>
  Effect.gen(function* () {
    const worklogs: Worklog[] = [];
    let startAt = 0;
    for (let page = 0; page < MAX_WORKLOG_PAGES; page++) {
      const params = new URLSearchParams({
        startAt: String(startAt),
        maxResults: String(WORKLOG_PAGE_SIZE),
        startedAfter: String(start.getTime()),
        startedBefore: String(end.getTime()),
      });
      const result = yield* jira(`/issue/${encodeURIComponent(issueId)}/worklog?${params}`, WorklogPage).pipe(worklogLimit.withPermits(1));
      worklogs.push(...result.worklogs);
      startAt = result.startAt + result.worklogs.length;
      if (startAt >= result.total) return { worklogs, truncated: false };
      if (result.worklogs.length === 0) return { worklogs, truncated: true };
    }
    return { worklogs, truncated: true };
  });
