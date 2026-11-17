import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StatusIntervalsState } from "@/hooks/use-status-intervals";

export function StatusIntervalsPanel({ state }: { state: StatusIntervalsState }) {
  const { t } = state;
  return (
    <section aria-label={t("title")} className="flex min-w-0 flex-col gap-3 rounded-2xl border p-3 text-sm">
      <h3 className="font-medium text-balance">{t("title")}</h3>
      <p className="text-xs text-muted-foreground">{t("explanation")}</p>
      {state.choices.length ? (
        <Select value={state.selectedKey ?? ""} onValueChange={state.onSelect}>
          <SelectTrigger aria-label={t("choose")} title={state.selectedLabel} className="min-h-8 w-full min-w-0 overflow-hidden text-left sm:max-w-md">
            <SelectValue placeholder={t("placeholder")}>
              {state.selectedLabel && <span className="min-w-0 truncate">{state.selectedLabel}</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent position="popper" className="max-w-[min(32rem,calc(100vw-2rem))] rounded-2xl">
            {state.choices.map((choice) => <SelectItem key={choice.key} value={choice.key} className="rounded-xl whitespace-normal wrap-anywhere">{choice.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : <p className="text-muted-foreground">{t("noStatus")}</p>}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground" aria-live="polite">
        <p>{state.coverageLabel}</p>
        <p className="tabular-nums">{t("coverage")}: {state.coverage}</p>
        <p className="tabular-nums">{t("asOf")}: {state.asOf}</p>
        <p>{t("calendar")}</p>
        {state.warnings.map((warning) => <p key={warning}>{warning}</p>)}
      </div>
      <AnimatePresence initial={false} mode="wait">
        {state.selectedKey ? (
          <Fade key={`${state.context}:${state.selectedKey}`}>
            <div className="flex flex-col gap-3">
              {state.aliases && <p className="text-xs text-muted-foreground wrap-anywhere">{t("renamed")}: {state.aliases}</p>}
              <dl className="grid gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><dt>{t("closed")}</dt><dd className="font-medium tabular-nums">{state.closed ?? "—"}</dd></div>
                {state.open !== undefined && <div className="flex flex-wrap items-baseline justify-between gap-2"><dt>{t("running")}</dt><dd className="tabular-nums">{state.open}</dd></div>}
              </dl>
              {state.rows.length ? (
                <Stagger role="list" aria-label={t("title")} className="flex flex-col gap-2">
                  {state.rows.map((row) => (
                    <StaggerItem key={row.key} role="listitem" className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-xl bg-muted/40 p-2 text-xs">
                      <div className="flex min-w-0 flex-col gap-1"><p className="tabular-nums wrap-anywhere">{row.start} → {row.end}</p><p className="text-muted-foreground">{row.label}{row.origin ? ` · ${row.origin}` : ""}</p></div>
                      {row.duration && <span className="shrink-0 tabular-nums">{row.duration}</span>}
                    </StaggerItem>
                  ))}
                </Stagger>
              ) : <p className="text-xs text-muted-foreground">{t("empty")}</p>}
              {state.more && <Button variant="ghost" onClick={state.onToggle} className="self-start rounded-xl">{t(state.expanded ? "showLess" : "showMore")}</Button>}
            </div>
          </Fade>
        ) : <Fade key="unselected"><p className="text-xs text-muted-foreground">{t("unselected")}</p></Fade>}
      </AnimatePresence>
    </section>
  );
}
