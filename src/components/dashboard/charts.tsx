import { useReducedMotion } from "motion/react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type Datum = { name: string } & Record<string, string | number | undefined>;

type SeriesChartProps = {
  data: readonly Datum[];
  config: ChartConfig;
  className?: string;
};

const BAR_RADIUS = 4;
const seriesKeys = (config: ChartConfig) => Object.keys(config);

export function BarListChart({
  data,
  label,
  color = "var(--chart-1)",
  className,
}: {
  data: readonly { name: string; value: number }[];
  label: string;
  color?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (data.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Keine Daten</p>;
  return (
    <ChartContainer
      config={{ value: { label, color } }}
      className={cn("aspect-auto w-full", className)}
      style={{ height: Math.max(120, data.length * 28 + 16) }}
    >
      <BarChart data={[...data]} layout="vertical" margin={{ left: 0, right: 16 }} barCategoryGap={4}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} interval={0} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={BAR_RADIUS} isAnimationActive={!reduce} />
      </BarChart>
    </ChartContainer>
  );
}

export function ColumnChart({ data, config, stacked = false, className }: SeriesChartProps & { stacked?: boolean }) {
  const reduce = useReducedMotion();
  const keys = seriesKeys(config);
  return (
    <ChartContainer config={config} className={cn("aspect-auto h-64 w-full", className)}>
      <BarChart data={[...data]} barGap={2}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        {keys.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {keys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={`var(--color-${key})`}
            stackId={stacked ? "stack" : undefined}
            radius={stacked ? (index === keys.length - 1 ? [BAR_RADIUS, BAR_RADIUS, 0, 0] : 0) : [BAR_RADIUS, BAR_RADIUS, 0, 0]}
            isAnimationActive={!reduce}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

export function TrendChart({ data, config, className }: SeriesChartProps) {
  const reduce = useReducedMotion();
  const keys = seriesKeys(config);
  return (
    <ChartContainer config={config} className={cn("aspect-auto h-64 w-full", className)}>
      <LineChart data={[...data]}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        {keys.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {keys.map((key) => (
          <Line
            key={key}
            dataKey={key}
            type="monotone"
            stroke={`var(--color-${key})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={!reduce}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

export function VolumeChart({ data, config, className }: SeriesChartProps) {
  const reduce = useReducedMotion();
  const [key] = seriesKeys(config);
  return (
    <ChartContainer config={config} className={cn("aspect-auto h-64 w-full", className)}>
      <AreaChart data={[...data]}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Area
          dataKey={key!}
          type="monotone"
          stroke={`var(--color-${key})`}
          fill={`var(--color-${key})`}
          fillOpacity={0.15}
          strokeWidth={2}
          isAnimationActive={!reduce}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function DonutChart({
  data,
  config,
  centerLabel,
  centerValue,
  className,
}: {
  data: readonly { key: string; value: number }[];
  config: ChartConfig;
  centerLabel: string;
  centerValue: string | number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <ChartContainer config={config} className={cn("relative mx-auto aspect-square h-64", className)}>
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
        <ChartLegend content={<ChartLegendContent nameKey="key" />} />
        <Pie
          data={[...data]}
          dataKey="value"
          nameKey="key"
          innerRadius="58%"
          outerRadius="80%"
          paddingAngle={2}
          stroke="var(--card)"
          strokeWidth={2}
          isAnimationActive={!reduce}
        >
          {data.map((entry) => (
            <Cell key={entry.key} fill={`var(--color-${entry.key})`} />
          ))}
        </Pie>
        <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-semibold">
          {centerValue}
        </text>
        <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">
          {centerLabel}
        </text>
      </PieChart>
    </ChartContainer>
  );
}
