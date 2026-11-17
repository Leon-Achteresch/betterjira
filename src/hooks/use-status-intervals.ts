import { useMemo, useState } from "react";
import { reconstructStatusIntervals, sumStatusIntervals, type StatusIdentity } from "@/lib/jira/status-intervals";
import type { IssueHistory } from "@/lib/jira/issue-history";
import { statusIntervalDuration, statusIntervalTranslator } from "@/lib/status-interval-text";
import { useLatestRef } from "./use-latest-ref";

export function useStatusIntervals({ context, history, current, created, updatedAt, failed, limit, locale = typeof document === "undefined" ? "de" : document.documentElement.lang || "de" }: {
  context: string; history?: IssueHistory; current?: StatusIdentity; created?: string; updatedAt: number; failed: boolean; limit: number; locale?: string;
}) {
  const [selection, setSelection] = useState<{ context: string; key: string; expanded: boolean }>();
  const latest = useLatestRef(context);
  const result = useMemo(() => history && current && updatedAt > 0 ? reconstructStatusIntervals({ history, current, created, asOf: new Date(updatedAt).toISOString() }) : undefined, [history, current, created, updatedAt]);
  const key = selection?.context === context ? selection.key : undefined;
  const summary = result && key && result.choices.some((choice) => choice.key === key) ? sumStatusIntervals(result.intervals, key) : undefined;
  const t = statusIntervalTranslator(locale);
  const date = (time: number) => new Date(time).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "shortOffset" });
  const selected = result?.choices.find((choice) => choice.key === key);
  const choices = result?.choices.map((choice) => {
    const name = choice.names[0] ?? t("unknown");
    const id = choice.id ? `ID ${choice.id}` : t("noId");
    return { key: choice.key, name, id, label: `${name} · ${id}` };
  }) ?? [];
  const rows = summary?.intervals.map((interval, index) => ({
    key: `${key}:${index}`,
    start: interval.start === undefined ? t("unknownStart") : date(interval.start),
    end: interval.end === undefined ? t("unknownEnd") : date(interval.end),
    duration: interval.duration === undefined ? undefined : statusIntervalDuration(interval.duration, locale),
    kind: interval.kind,
    label: t(interval.kind === "closed" ? "confirmed" : interval.kind === "open" ? "open" : "cut"),
    origin: interval.origin === "creation" ? t("creation") : undefined,
  })) ?? [];
  const expanded = selection?.context === context && selection.expanded;
  return result && history ? {
    context, t, selectedKey: summary ? key : undefined,
    selectedLabel: choices.find((choice) => choice.key === key)?.label,
    selected: summary ? choices.find((choice) => choice.key === key) : undefined,
    complete: result.complete && !failed,
    choices,
    onSelect: (key: string) => { if (latest.current === context) setSelection({ context, key, expanded: false }); },
    aliases: selected && selected.names.length > 1 ? selected.names.slice(1).join(" / ") : undefined,
    coverage: `${history.covered} / ${history.total} · ${t("limit")} ${limit}`,
    coverageLabel: t(result.complete && !failed ? "full" : "partial"),
    warnings: [...result.warnings.filter((warning) => warning !== "coverage").map((warning) => t(warning)), ...(failed ? [t("failed")] : [])],
    asOf: date(updatedAt),
    closed: summary && !result.warnings.includes("invalid") ? statusIntervalDuration(summary.closedMs, locale) : undefined,
    open: summary?.openMs === undefined ? undefined : statusIntervalDuration(summary.openMs, locale),
    rows: expanded ? rows : rows.slice(0, 5),
    more: rows.length > 5,
    total: rows.length,
    expanded,
    onToggle: () => { if (latest.current === context && key) setSelection({ context, key, expanded: !expanded }); },
  } : undefined;
}

export type StatusIntervalsState = NonNullable<ReturnType<typeof useStatusIntervals>>;
