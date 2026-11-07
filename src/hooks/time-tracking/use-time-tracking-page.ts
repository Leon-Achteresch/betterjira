import { useNavigate } from "@tanstack/react-router";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { useUrlText } from "@/hooks/search/use-url-text";
import { normalizeQuery } from "@/lib/search/search-params";
import { MAX_CANDIDATE_ISSUES } from "@/lib/time-tracking/client";
import { filterTimeSummary } from "@/lib/time-tracking/filter";
import { coverageMessages, formatSeconds, timeDayViews } from "@/lib/time-tracking/presentation";
import {
  activePreset,
  presetSearch,
  resolveTimeRange,
  shiftTimeRange,
  TIME_RANGE_PRESETS,
  timeRangeLabel,
  type TimeRangeSearch,
} from "@/lib/time-tracking/range";
import { useMyWorklogs } from "./use-my-worklogs";

export function useTimeTrackingPage(search: TimeRangeSearch) {
  const navigate = useNavigate({ from: "/zeiterfassung" });
  const session = useJiraSession();
  const today = new Date();
  const range = resolveTimeRange(search, today);
  const active = activePreset(range, today);
  const worklogs = useMyWorklogs(range);
  const { summary, coverage } = worklogs;
  const text = useUrlText(search.q ?? "", (q) => void navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true }));
  const query = normalizeQuery(text.text);
  const keepQuery = (next: TimeRangeSearch): TimeRangeSearch => ({ ...next, q: query || undefined });
  const show = (next: TimeRangeSearch) => void navigate({ to: "/zeiterfassung", search: keepQuery(next) });
  const unit = range.kind === "tag" ? "Tag" : "Woche";
  const loading = coverage.pendingCount > 0;
  const matches = summary && query ? filterTimeSummary(summary, query) : undefined;
  const empty = !!summary && summary.entryCount === 0 && !loading;

  return {
    view: worklogs.error ? "error" : worklogs.pending ? "pending" : "ready",
    session,
    rangeKey: `${range.kind}:${range.start.getTime()}`,
    label: timeRangeLabel(range),
    previousLabel: range.kind === "tag" ? "Vorheriger Tag" : "Vorherige Woche",
    nextLabel: range.kind === "tag" ? "Nächster Tag" : "Nächste Woche",
    presets: TIME_RANGE_PRESETS.map((preset) => ({ ...preset, search: keepQuery(presetSearch(preset.id, today)), active: preset.id === active })),
    previous: () => show(shiftTimeRange(range, -1)),
    next: () => show(shiftTimeRange(range, 1)),
    pending: worklogs.pending,
    error: worklogs.error,
    refreshError: worklogs.refreshError,
    refreshing: worklogs.refreshing,
    retry: worklogs.retry,
    retryFailed: worklogs.retryFailed,
    refresh: worklogs.refresh,
    total: formatSeconds(summary?.seconds ?? 0),
    totalLabel: coverage.complete ? `Summe ${unit}` : `Summe ${unit} (geladener Stand)`,
    totalHint: loading ? `Lädt noch ${coverage.pendingCount} von ${worklogs.issueCount} Tickets` : undefined,
    entryCount: summary?.entryCount ?? 0,
    issueCount: summary?.issueCount ?? 0,
    search: { value: text.text, onChange: text.setText },
    matches: matches && {
      total: formatSeconds(matches.seconds),
      label: coverage.complete ? "Summe Treffer" : "Summe Treffer (geladener Stand)",
      hint: `${matches.entryCount} von ${summary?.entryCount ?? 0} ${coverage.complete ? "Buchungen" : "geladenen Buchungen"}`,
    },
    days: matches ? timeDayViews(matches, today) : summary ? timeDayViews(summary, today) : [],
    dayTotalLabel: matches
      ? coverage.complete ? "Treffer am Tag" : "Treffer am Tag (geladener Stand)"
      : "Tagessumme",
    empty,
    noMatches: matches?.entryCount === 0 && !!summary?.entryCount,
    noMatchesTitle: `Keine Treffer für „${query}“`,
    resetSearch: () => text.setText(""),
    partial: loading ? [] : coverageMessages(coverage, MAX_CANDIDATE_ISSUES),
    canRetryFailed: coverage.failedKeys.length > 0,
    emptyTitle: range.kind === "tag" ? "Keine Buchungen an diesem Tag" : "Keine Buchungen in dieser Woche",
  };
}
