import { format } from "date-fns";
import type { TimeSummary } from "./aggregate";
import type { TimeCoverage } from "./coverage";
import { dayKey, dayLabel } from "./range";

export const formatSeconds = (total: number) => {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts = [hours && `${hours} h`, minutes && `${minutes} min`, seconds && `${seconds} s`].filter(Boolean);
  return parts.length ? parts.join(" ") : "0 min";
};

export const timeDayViews = (summary: TimeSummary, today: Date) =>
  summary.days.map((day) => ({
    day: day.day,
    label: dayLabel(day.day),
    total: formatSeconds(day.seconds),
    isToday: day.day === dayKey(today),
    entries: day.entries.map((entry) => ({
      id: entry.id,
      issueKey: entry.issueKey,
      summary: entry.summary,
      comment: entry.comment,
      time: format(entry.started, "HH:mm"),
      duration: formatSeconds(entry.seconds),
    })),
  }));

export const coverageMessages = (coverage: TimeCoverage, maxIssues: number) => [
  ...(coverage.issuesTruncated ? [`Nur die ersten ${maxIssues} Tickets mit deinen Buchungen wurden geladen.`] : []),
  ...(coverage.failedKeys.length ? [`Nicht geladen: ${coverage.failedKeys.join(", ")}.`] : []),
  ...(coverage.truncatedKeys.length ? [`Nicht alle Buchungen geladen bei ${coverage.truncatedKeys.join(", ")}.`] : []),
];
