import { AnimatePresence } from "motion/react";
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { Fade } from "@/components/motion/fade";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StatusIntervalsState } from "@/hooks/use-status-intervals";
import { cn } from "@/lib/utils";

type Row = StatusIntervalsState["rows"][number];

const DOT: Record<Row["kind"], string> = {
  closed: "bg-foreground/70",
  open: "bg-info ring-3 ring-info/20",
  cut: "border border-dashed border-muted-foreground bg-transparent",
};

const ID_CHIP = "shrink-0 rounded-xl border px-1.5 py-px font-mono text-[10px] leading-4 text-muted-foreground tabular-nums";

function StayRow({ row, notSummed }: { row: Row; notSummed: string }) {
  return (
    <StaggerItem role="listitem" className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 px-3 py-2 text-xs">
      <span aria-hidden className={cn("mt-1 size-2 rounded-full", DOT[row.kind])} />
      <div className="flex min-w-0 flex-col gap-0.5 tabular-nums">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="min-w-0 wrap-anywhere">{row.start}</p>
          <span className={cn("ml-auto text-right", row.kind === "closed" ? "font-medium" : "text-muted-foreground")}>
            {row.duration ?? notSummed}
          </span>
        </div>
        <p className="wrap-anywhere text-muted-foreground">→ {row.end}</p>
        <p className={cn("wrap-anywhere", row.kind === "open" ? "text-info" : "text-muted-foreground")}>
          {row.label}{row.origin ? ` · ${row.origin}` : ""}
        </p>
      </div>
    </StaggerItem>
  );
}

export function StatusIntervalsPanel({ state }: { state: StatusIntervalsState }) {
  const { t } = state;
  const NoticeIcon = state.complete ? CircleCheckIcon : TriangleAlertIcon;
  return (
    <section aria-label={t("title")} className="flex min-w-0 flex-col gap-3 rounded-2xl border p-3 text-sm">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-balance">{t("title")}</h3>
        <p className="text-xs text-muted-foreground">{t("explanation")}</p>
      </div>
      {state.choices.length ? (
        <Select value={state.selectedKey ?? ""} onValueChange={state.onSelect}>
          <SelectTrigger aria-label={t("choose")} title={state.selectedLabel} className="min-h-8 w-full min-w-0 overflow-hidden rounded-xl text-left sm:max-w-md">
            <SelectValue placeholder={t("placeholder")}>
              {state.selected && <span className="min-w-0 truncate">{state.selected.name}</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent position="popper" className="max-w-[min(32rem,calc(100vw-2rem))] rounded-2xl">
            {state.choices.map((choice) => (
              <SelectItem key={choice.key} value={choice.key} className="rounded-xl py-1.5 *:[span]:last:w-full">
                <span className="min-w-0 flex-1 whitespace-normal wrap-anywhere">{choice.name}</span>
                <span className={ID_CHIP}>{choice.id}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : <p className="text-muted-foreground">{t("noStatus")}</p>}
      <AnimatePresence initial={false} mode="wait">
        {state.selected ? (
          <Fade key={`${state.context}:${state.selectedKey}`}>
            <div className="flex flex-col gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 font-medium text-balance wrap-anywhere">{state.selected.name}</p>
                  <span className={cn(ID_CHIP, "mt-0.5")}>{state.selected.id}</span>
                </div>
                {state.aliases && <p className="text-xs text-muted-foreground wrap-anywhere">{t("renamed")}: {state.aliases}</p>}
              </div>
              <dl className="grid overflow-hidden rounded-xl border sm:grid-cols-2 sm:divide-x max-sm:divide-y">
                <div className={cn("flex flex-col gap-1 p-3", state.open === undefined && "sm:col-span-2")}>
                  <dt className="text-xs text-muted-foreground">{t("closed")}</dt>
                  <dd className="text-xl font-medium tracking-tight tabular-nums">{state.closed ?? "—"}</dd>
                </div>
                {state.open !== undefined && (
                  <div className="flex flex-col gap-1 bg-muted/30 p-3">
                    <dt className="text-xs text-muted-foreground">{t("running")}</dt>
                    <dd className="text-xl tracking-tight text-muted-foreground tabular-nums">{state.open}</dd>
                  </div>
                )}
              </dl>
              {state.rows.length ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-muted-foreground tabular-nums">{t("stays")} · {state.rows.length} / {state.total}</p>
                  <Stagger role="list" aria-label={t("stays")} className="flex flex-col divide-y overflow-hidden rounded-xl border">
                    {state.rows.map((row) => <StayRow key={row.key} row={row} notSummed={t("notSummed")} />)}
                  </Stagger>
                  {state.more && (
                    <Button variant="ghost" size="sm" onClick={state.onToggle} aria-expanded={state.expanded} className="min-h-8 self-start rounded-xl">
                      {state.expanded ? t("showLess") : `${t("showMore")} (${state.total})`}
                    </Button>
                  )}
                </div>
              ) : <p className="text-xs text-muted-foreground">{t("empty")}</p>}
            </div>
          </Fade>
        ) : <Fade key="unselected"><p className="text-xs text-muted-foreground">{t("unselected")}</p></Fade>}
      </AnimatePresence>
      <div aria-live="polite" className="flex flex-col gap-1.5">
        <p className={cn("flex items-start gap-1.5 text-xs", state.complete ? "text-success" : "text-warning")}>
          <NoticeIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>{state.coverageLabel}</span>
        </p>
        {state.warnings.length > 0 && (
          <div className="flex flex-col gap-1 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
            {state.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        )}
        <div className="flex flex-col gap-0.5 border-t pt-2 text-[11px] text-muted-foreground">
          <p className="tabular-nums">{t("coverage")}: {state.coverage}</p>
          <p className="tabular-nums">{t("asOf")}: {state.asOf}</p>
          <p>{t("calendar")}</p>
        </div>
      </div>
    </section>
  );
}
