import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { XIcon } from "lucide-react";
import { ColumnChart } from "@/components/dashboard/charts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EASE_OUT, SPRING_PANEL } from "@/lib/ease";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; options: Record<T, string>; onChange: (value: T) => void };

export type InsightsPanelRow = { name: string; total: number; segments: number[] };

type InsightsPanelProps<M extends string, S extends string, G extends string> = {
  total: number;
  unit: string;
  measure: Option<M>;
  slice: Option<S>;
  segment: Option<G>;
  segments: string[];
  rows: InsightsPanelRow[];
  colorOf: (segment: string, index: number) => string;
  renderLabel: (name: string) => ReactNode;
  active: readonly string[];
  canSelect: (name: string) => boolean;
  onSelect: (name: string) => void;
  onClose: () => void;
};

const TOTAL_KEY = "total";

function OptionSelect<T extends string>({ label, option }: { label: string; option: Option<T> }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <Select
        value={option.value}
        onValueChange={(value) => {
          const match = (Object.keys(option.options) as T[]).find((key) => key === value);
          if (match) option.onChange(match);
        }}
      >
        <SelectTrigger size="sm" className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(option.options) as [T, string][]).map(([value, name]) => (
            <SelectItem key={value} value={value}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function InsightsPanel<M extends string, S extends string, G extends string>({
  total,
  unit,
  measure,
  slice,
  segment,
  segments,
  rows,
  colorOf,
  renderLabel,
  active,
  canSelect,
  onSelect,
  onClose,
}: InsightsPanelProps<M, S, G>) {
  const reduce = useReducedMotion();
  const keys = segments.length > 0 ? segments.map((_, index) => `s${index}`) : [TOTAL_KEY];
  const config = Object.fromEntries(
    segments.length > 0
      ? segments.map((name, index) => [`s${index}`, { label: name, color: colorOf(name, index) }])
      : [[TOTAL_KEY, { label: measure.options[measure.value], color: "var(--chart-1)" }]],
  );
  const data = rows.map((row) => ({
    name: row.name,
    ...Object.fromEntries(segments.length > 0 ? row.segments.map((value, index) => [keys[index], value]) : [[TOTAL_KEY, row.total]]),
  }));
  const max = Math.max(1, ...rows.map((row) => row.total));

  return (
    <motion.aside
      aria-label="Insights"
      initial={{ opacity: 0, x: reduce ? 0 : 12 }}
      animate={{ opacity: 1, x: 0, transition: reduce ? { duration: 0.15 } : SPRING_PANEL }}
      exit={{ opacity: 0, x: reduce ? 0 : 8, transition: { duration: 0.15, ease: EASE_OUT } }}
      className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:w-[420px]"
    >
      <header className="flex items-start justify-between gap-2 px-4 pt-4">
        <p className="flex items-baseline gap-1.5">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={total}
              initial={{ opacity: 0, y: reduce ? 0 : 4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
              exit={{ opacity: 0, y: reduce ? 0 : -4, transition: { duration: 0.12 } }}
              className="text-xl font-semibold tabular-nums"
            >
              {total.toLocaleString("de-DE")}
            </motion.span>
          </AnimatePresence>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </p>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Insights schließen">
          <XIcon />
        </Button>
      </header>
      <div className="flex gap-2 px-4 pt-3">
        <OptionSelect label="Messgröße" option={measure} />
        <OptionSelect label="Gruppierung" option={slice} />
        <OptionSelect label="Segment" option={segment} />
      </div>
      <div className="min-h-0 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Keine Vorgänge für diese Auswahl.</p>
        ) : (
          <>
            <ColumnChart data={data} config={config} stacked allTicks className="h-56 px-2 pt-4" />
            <div className="overflow-x-auto border-t">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="sticky left-0 bg-card px-4 py-2 text-left font-medium">{slice.options[slice.value]}</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">{measure.options[measure.value]}</th>
                    {segments.map((name, index) => (
                      <th key={name} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden className="size-2 rounded-full" style={{ background: colorOf(name, index) }} />
                          {name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const selected = active.includes(row.name);
                    const selectable = canSelect(row.name);
                    return (
                      <motion.tr
                        key={row.name}
                        layout={reduce ? false : "position"}
                        initial={{ opacity: 0, y: reduce ? 0 : 4 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT, delay: Math.min(index, 12) * 0.025 } }}
                        className={cn("group border-b last:border-0", selected && "bg-primary/12")}
                      >
                        <td className={cn("sticky left-0 max-w-44 px-2 py-1", selected ? "bg-transparent" : "bg-card")}>
                          <button
                            type="button"
                            disabled={!selectable}
                            aria-pressed={selected}
                            title={selectable ? `Board nach „${row.name}“ filtern` : undefined}
                            onClick={() => onSelect(row.name)}
                            className="relative flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1 text-left outline-none enabled:hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                          >
                            <span
                              aria-hidden
                              className="absolute inset-y-1 left-0 origin-left rounded-sm bg-primary/8 transition-transform duration-300"
                              style={{ width: "100%", transform: `scaleX(${row.total / max})` }}
                            />
                            <span className="relative flex min-w-0 items-center gap-2">{renderLabel(row.name)}</span>
                          </button>
                        </td>
                        <td className="px-3 py-1 text-right font-medium tabular-nums">{row.total.toLocaleString("de-DE")}</td>
                        {row.segments.map((value, index) => (
                          <td key={segments[index]} className={cn("px-3 py-1 text-right tabular-nums", value === 0 && "text-muted-foreground/60")}>
                            {value.toLocaleString("de-DE")}
                          </td>
                        ))}
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </motion.aside>
  );
}
