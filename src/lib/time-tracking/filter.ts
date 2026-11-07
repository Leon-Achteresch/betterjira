import type { TimeSummary } from "./aggregate";

const terms = (query: string) => query.toLocaleLowerCase("de").split(/\s+/).filter(Boolean);

export const filterTimeSummary = (summary: TimeSummary, query: string): TimeSummary => {
  const needles = terms(query);
  const days = summary.days
    .map((day) => {
      const entries = day.entries.filter((entry) => {
        const haystack = `${entry.issueKey} ${entry.summary} ${entry.comment}`.toLocaleLowerCase("de");
        return needles.every((needle) => haystack.includes(needle));
      });
      return { day: day.day, entries, seconds: entries.reduce((total, entry) => total + entry.seconds, 0) };
    })
    .filter((day) => day.entries.length > 0);
  const entries = days.flatMap((day) => day.entries);
  return {
    days,
    seconds: days.reduce((total, day) => total + day.seconds, 0),
    entryCount: entries.length,
    issueCount: new Set(entries.map((entry) => entry.issueKey)).size,
  };
};
