import type { ReactNode } from "react";
import {
  ActivityIcon,
  AlarmClockIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  ClockIcon,
  GaugeIcon,
  HourglassIcon,
  InboxIcon,
  LayersIcon,
  TimerIcon,
  TrendingUpIcon,
  UserXIcon,
  UsersIcon,
} from "lucide-react";
import { BarListChart, ColumnChart, DonutChart, TrendChart, VolumeChart } from "@/components/dashboard/charts";
import { ChartCard } from "@/components/dashboard/chart-card";
import { type DataColumn, DataTable } from "@/components/dashboard/data-table";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Stagger } from "@/components/motion/stagger";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChartConfig } from "@/components/ui/chart";
import { type GroupStats, type IssueRef, MAX_STATS_ISSUES, type ProjectStats } from "@/lib/jira/project-stats";

type ProjectStatsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  stats?: ProjectStats;
  isPending: boolean;
  error?: Error | null;
  truncated: boolean;
  onIssueSelect: (key: string) => void;
};

const CATEGORY_CONFIG = {
  todo: { label: "Offen", color: "var(--chart-3)" },
  progress: { label: "In Arbeit", color: "var(--chart-1)" },
  done: { label: "Erledigt", color: "var(--chart-2)" },
} satisfies ChartConfig;

const FLOW_CONFIG = {
  created: { label: "Erstellt", color: "var(--chart-1)" },
  resolved: { label: "Erledigt", color: "var(--chart-2)" },
} satisfies ChartConfig;

const BACKLOG_CONFIG = { backlog: { label: "Offener Bestand", color: "var(--chart-3)" } } satisfies ChartConfig;

const GROUP_STACK_CONFIG = {
  open: { label: "Offen", color: "var(--chart-3)" },
  inProgress: { label: "In Arbeit", color: "var(--chart-1)" },
  done: { label: "Erledigt", color: "var(--chart-2)" },
} satisfies ChartConfig;

const TABS = [
  { value: "overview", label: "Übersicht" },
  { value: "flow", label: "Verlauf" },
  { value: "status", label: "Status" },
  { value: "people", label: "Personen" },
  { value: "categories", label: "Kategorien" },
  { value: "times", label: "Zeiten" },
  { value: "risks", label: "Fälligkeiten & Risiken" },
];

const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 0 });

const formatDays = (value: number | undefined) => (value === undefined ? "–" : `${number.format(value)} T`);
const formatHours = (value: number) => `${number.format(value)} h`;

const GROUP_COLUMNS: DataColumn<GroupStats>[] = [
  { header: "Name", cell: (row) => row.name, className: "max-w-56 truncate font-medium" },
  { header: "Gesamt", cell: (row) => row.total, numeric: true },
  { header: "Offen", cell: (row) => row.open, numeric: true },
  { header: "In Arbeit", cell: (row) => row.inProgress, numeric: true },
  { header: "Erledigt", cell: (row) => row.done, numeric: true },
  { header: "Quote", cell: (row) => percent.format(row.doneRate), numeric: true },
  { header: "Überfällig", cell: (row) => row.overdue, numeric: true },
  { header: "Erledigt 30 T", cell: (row) => row.resolvedRecently, numeric: true },
  { header: "Median Durchlauf", cell: (row) => formatDays(row.medianLead), numeric: true },
  { header: "Gebucht", cell: (row) => formatHours(row.timeSpent), numeric: true },
];

const issueColumns = (extra: DataColumn<IssueRef>): DataColumn<IssueRef>[] => [
  { header: "Schlüssel", cell: (row) => row.key, className: "font-mono text-xs" },
  { header: "Zusammenfassung", cell: (row) => row.summary, className: "max-w-96 truncate" },
  { header: "Status", cell: (row) => row.status },
  { header: "Zugewiesen", cell: (row) => row.assignee, className: "max-w-40 truncate" },
  extra,
];

const OVERDUE_COLUMNS = issueColumns({ header: "Fällig", cell: (row) => row.duedate ?? "–", numeric: true });
const OLDEST_COLUMNS = issueColumns({ header: "Alter", cell: (row) => `${row.ageDays} T`, numeric: true });
const STALE_COLUMNS = issueColumns({ header: "Ohne Änderung", cell: (row) => `${row.idleDays} T`, numeric: true });

const groupChartData = (groups: readonly GroupStats[]) =>
  groups.slice(0, 12).map(({ name, open, inProgress, done }) => ({ name, open, inProgress, done }));

function Grid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return <div className={columns === 3 ? "grid gap-3 lg:grid-cols-3" : "grid gap-3 lg:grid-cols-2"}>{children}</div>;
}

function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">{children}</div>;
}

function Panel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsContent value={value} className="min-h-0">
      <Stagger className="flex flex-col gap-3">{children}</Stagger>
    </TabsContent>
  );
}

function Overview({ stats }: { stats: ProjectStats }) {
  return (
    <Panel value="overview">
      <TileGrid>
        <StatTile icon={<LayersIcon />} label="Vorgänge gesamt" value={stats.total} hint={`${stats.contributors} Bearbeiter`} />
        <StatTile icon={<InboxIcon />} label="Offen" value={stats.todoCount} hint={`${stats.openCount} nicht erledigt`} />
        <StatTile icon={<CircleDotIcon />} label="In Arbeit" value={stats.inProgressCount} />
        <StatTile icon={<CheckCircle2Icon />} label="Erledigt" value={stats.doneCount} hint={`${percent.format(stats.doneRate)} Quote`} />
        <StatTile icon={<TrendingUpIcon />} label="Erstellt (30 T)" value={stats.createdRecently} hint={`${stats.resolvedRecently} erledigt`} />
        <StatTile
          icon={<ActivityIcon />}
          label="Netto-Zufluss (30 T)"
          value={stats.netFlow > 0 ? `+${stats.netFlow}` : stats.netFlow}
          hint={stats.netFlow > 0 ? "Bestand wächst" : "Bestand schrumpft"}
          tone={stats.netFlow > 0 ? "warning" : "default"}
        />
        <StatTile icon={<TimerIcon />} label="Median Durchlaufzeit" value={formatDays(stats.medianLead)} hint={`Ø ${formatDays(stats.avgLead)}`} />
        <StatTile icon={<GaugeIcon />} label="85. Perzentil" value={formatDays(stats.p85Lead)} hint="Durchlaufzeit" />
        <StatTile icon={<HourglassIcon />} label="Median Alter offen" value={formatDays(stats.medianOpenAge)} hint={`ältester ${formatDays(stats.oldestOpenAge)}`} />
        <StatTile icon={<ActivityIcon />} label="Durchsatz / Woche" value={number.format(stats.throughputPerWeek ?? 0)} hint="Ø letzte 12 Wochen" />
        <StatTile
          icon={<AlarmClockIcon />}
          label="Überfällig"
          value={stats.overdueCount}
          hint={`${stats.dueThisWeek} fällig in 7 T`}
          tone={stats.overdueCount > 0 ? "critical" : "default"}
        />
        <StatTile
          icon={<UserXIcon />}
          label="Offen ohne Zuweisung"
          value={stats.unassignedOpen}
          tone={stats.unassignedOpen > 0 ? "warning" : "default"}
        />
      </TileGrid>
      <Grid columns={3}>
        <ChartCard title="Statusverteilung" description="Nach Statuskategorie">
          <DonutChart data={stats.categories} config={CATEGORY_CONFIG} centerValue={stats.total} centerLabel="Vorgänge" />
        </ChartCard>
        <ChartCard title="Erstellt vs. erledigt" description="Pro Woche, letzte 26 Wochen" className="lg:col-span-2">
          <TrendChart data={stats.weekly} config={FLOW_CONFIG} />
        </ChartCard>
      </Grid>
    </Panel>
  );
}

function Flow({ stats }: { stats: ProjectStats }) {
  return (
    <Panel value="flow">
      <Grid>
        <ChartCard title="Zu- und Abfluss pro Monat" description="Letzte 12 Monate">
          <ColumnChart data={stats.monthly} config={FLOW_CONFIG} />
        </ChartCard>
        <ChartCard title="Offener Bestand" description="Nicht erledigte Vorgänge am Monatsende">
          <VolumeChart data={stats.monthly} config={BACKLOG_CONFIG} />
        </ChartCard>
        <ChartCard title="Erstellt vs. erledigt pro Woche" description="Letzte 26 Wochen" className="lg:col-span-2">
          <ColumnChart data={stats.weekly} config={FLOW_CONFIG} className="h-72" />
        </ChartCard>
        <ChartCard title="Aktivität nach Wochentag" description="Gesamter Zeitraum">
          <ColumnChart data={stats.weekdays} config={FLOW_CONFIG} />
        </ChartCard>
        <ChartCard title="Aktivität nach Uhrzeit" description="Stunde der Erstellung bzw. Erledigung">
          <TrendChart data={stats.hoursOfDay} config={FLOW_CONFIG} />
        </ChartCard>
      </Grid>
    </Panel>
  );
}

function Status({ stats }: { stats: ProjectStats }) {
  return (
    <Panel value="status">
      <TileGrid>
        {stats.categories.map((category) => (
          <StatTile
            key={category.key}
            label={category.name}
            value={category.value}
            hint={stats.total ? percent.format(category.value / stats.total) : undefined}
          />
        ))}
        <StatTile label="Status im Einsatz" value={stats.statuses.length} />
        <StatTile icon={<ClockIcon />} label="Ohne Änderung > 30 T" value={stats.staleCount} tone={stats.staleCount > 0 ? "warning" : "default"} />
      </TileGrid>
      <Grid>
        <ChartCard title="Alle Status" description="Anzahl Vorgänge je Status">
          <BarListChart data={stats.statuses} label="Vorgänge" />
        </ChartCard>
        <ChartCard title="Offene Vorgänge je Status" description="Wo sich Arbeit staut">
          <BarListChart data={stats.openStatuses} label="Offen" color="var(--chart-3)" />
        </ChartCard>
        <ChartCard title="Statuskategorie je Vorgangstyp" className="lg:col-span-2">
          <ColumnChart data={groupChartData(stats.types)} config={GROUP_STACK_CONFIG} stacked />
        </ChartCard>
      </Grid>
    </Panel>
  );
}

function People({ stats }: { stats: ProjectStats }) {
  return (
    <Panel value="people">
      <Grid>
        <ChartCard title="Arbeitslast je Person" description="Top 12 nach Anzahl Vorgänge" className="lg:col-span-2">
          <ColumnChart data={groupChartData(stats.assignees)} config={GROUP_STACK_CONFIG} stacked className="h-72" />
        </ChartCard>
        <ChartCard title="Bearbeiter im Detail" className="lg:col-span-2">
          <DataTable columns={GROUP_COLUMNS} rows={stats.assignees} rowKey={(row) => row.name} />
        </ChartCard>
        <ChartCard title="Melder" description="Wer erstellt die meisten Vorgänge">
          <BarListChart data={stats.reporters} label="Gemeldet" color="var(--chart-4)" />
        </ChartCard>
        <ChartCard title="Gebuchte Zeit je Person">
          <BarListChart
            data={stats.assignees.filter((row) => row.timeSpent > 0).map((row) => ({ name: row.name, value: row.timeSpent }))}
            label="Stunden"
            color="var(--chart-5)"
          />
        </ChartCard>
      </Grid>
    </Panel>
  );
}

function Categories({ stats }: { stats: ProjectStats }) {
  return (
    <Panel value="categories">
      <Grid>
        <ChartCard title="Vorgangstypen">
          <ColumnChart data={groupChartData(stats.types)} config={GROUP_STACK_CONFIG} stacked />
        </ChartCard>
        <ChartCard title="Prioritäten">
          <ColumnChart data={groupChartData(stats.priorities)} config={GROUP_STACK_CONFIG} stacked />
        </ChartCard>
        <ChartCard title="Vorgangstypen im Detail" className="lg:col-span-2">
          <DataTable columns={GROUP_COLUMNS} rows={stats.types} rowKey={(row) => row.name} />
        </ChartCard>
        <ChartCard title="Prioritäten im Detail" className="lg:col-span-2">
          <DataTable columns={GROUP_COLUMNS} rows={stats.priorities} rowKey={(row) => row.name} />
        </ChartCard>
        <ChartCard title="Labels" description={`Top 15 · ${stats.unlabeled} Vorgänge ohne Label`}>
          <BarListChart data={stats.labels} label="Vorgänge" color="var(--chart-3)" />
        </ChartCard>
        <ChartCard title="Komponenten" description="Top 15">
          <BarListChart data={stats.components} label="Vorgänge" color="var(--chart-4)" />
        </ChartCard>
        <ChartCard title="Lösungsversionen" description="Top 15" className="lg:col-span-2">
          <BarListChart data={stats.versions} label="Vorgänge" color="var(--chart-2)" />
        </ChartCard>
      </Grid>
    </Panel>
  );
}

function Times({ stats }: { stats: ProjectStats }) {
  return (
    <Panel value="times">
      <TileGrid>
        <StatTile icon={<TimerIcon />} label="Ø Durchlaufzeit" value={formatDays(stats.avgLead)} />
        <StatTile label="Median Durchlaufzeit" value={formatDays(stats.medianLead)} />
        <StatTile label="85. Perzentil" value={formatDays(stats.p85Lead)} hint="85 % sind schneller" />
        <StatTile icon={<ClockIcon />} label="Gebuchte Zeit" value={formatHours(stats.timeSpentHours)} />
        <StatTile label="Geschätzte Zeit" value={formatHours(stats.estimateHours)} />
        <StatTile
          label="Ist / Schätzung"
          value={stats.estimateAccuracy === undefined ? "–" : percent.format(stats.estimateAccuracy)}
          hint="Median erledigter Vorgänge"
        />
      </TileGrid>
      <Grid>
        <ChartCard title="Verteilung der Durchlaufzeit" description="Erstellung bis Erledigung">
          <ColumnChart data={stats.leadBuckets} config={{ value: { label: "Erledigt", color: "var(--chart-2)" } }} />
        </ChartCard>
        <ChartCard title="Alter offener Vorgänge" description="Seit Erstellung">
          <ColumnChart data={stats.ageBuckets} config={{ value: { label: "Offen", color: "var(--chart-3)" } }} />
        </ChartCard>
        <ChartCard title="Median Durchlaufzeit je Typ" description="In Tagen">
          <BarListChart
            data={stats.types.filter((row) => row.medianLead !== undefined).map((row) => ({ name: row.name, value: Math.round(row.medianLead!) }))}
            label="Tage"
          />
        </ChartCard>
        <ChartCard title="Median Durchlaufzeit je Priorität" description="In Tagen">
          <BarListChart
            data={stats.priorities.filter((row) => row.medianLead !== undefined).map((row) => ({ name: row.name, value: Math.round(row.medianLead!) }))}
            label="Tage"
            color="var(--chart-4)"
          />
        </ChartCard>
      </Grid>
    </Panel>
  );
}

function Risks({ stats, onIssueSelect }: { stats: ProjectStats; onIssueSelect: (key: string) => void }) {
  const select = (row: IssueRef) => onIssueSelect(row.key);
  return (
    <Panel value="risks">
      <TileGrid>
        <StatTile icon={<AlarmClockIcon />} label="Überfällig" value={stats.overdueCount} tone={stats.overdueCount > 0 ? "critical" : "default"} />
        <StatTile icon={<CalendarClockIcon />} label="Fällig in 7 T" value={stats.dueThisWeek} />
        <StatTile label="Ohne Fälligkeit" value={stats.noDueDate} hint="offene Vorgänge" />
        <StatTile icon={<ClockIcon />} label="Ohne Änderung > 30 T" value={stats.staleCount} tone={stats.staleCount > 0 ? "warning" : "default"} />
        <StatTile icon={<UserXIcon />} label="Ohne Zuweisung" value={stats.unassignedOpen} />
        <StatTile icon={<UsersIcon />} label="Bearbeiter" value={stats.contributors} />
      </TileGrid>
      <ChartCard title="Anstehende Fälligkeiten" description="Offene Vorgänge je Woche, nächste 8 Wochen">
        <ColumnChart data={stats.dueTimeline} config={{ value: { label: "Fällig", color: "var(--chart-4)" } }} className="h-52" />
      </ChartCard>
      <ChartCard title="Überfällige Vorgänge" description="Älteste Fälligkeit zuerst">
        <DataTable columns={OVERDUE_COLUMNS} rows={stats.overdueIssues} rowKey={(row) => row.key} onRowClick={select} empty="Nichts überfällig" />
      </ChartCard>
      <ChartCard title="Älteste offene Vorgänge">
        <DataTable columns={OLDEST_COLUMNS} rows={stats.oldestOpen} rowKey={(row) => row.key} onRowClick={select} />
      </ChartCard>
      <ChartCard title="Liegengebliebene Vorgänge" description="Offen und seit über 30 Tagen unverändert">
        <DataTable columns={STALE_COLUMNS} rows={stats.staleIssues} rowKey={(row) => row.key} onRowClick={select} empty="Nichts liegengeblieben" />
      </ChartCard>
    </Panel>
  );
}

export function ProjectStatsDialog({
  open,
  onOpenChange,
  projectName,
  stats,
  isPending,
  error,
  truncated,
  onIssueSelect,
}: ProjectStatsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,1000px)] flex-col gap-0 p-0 sm:max-w-[min(1400px,calc(100%-4rem))]">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>Statistiken · {projectName}</DialogTitle>
          <DialogDescription>
            {stats
              ? `${stats.total} Vorgänge ausgewertet${truncated ? ` (auf die neuesten ${MAX_STATS_ISSUES} begrenzt)` : ""}`
              : "Vorgänge werden geladen"}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="p-6 text-sm text-destructive">
            Statistiken konnten nicht geladen werden: {error.message}
          </p>
        ) : isPending || !stats ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
            <Spinner />
            Lade alle Vorgänge…
          </div>
        ) : (
          <Tabs defaultValue="overview" className="min-h-0 flex-1 gap-0">
            <div className="overflow-x-auto border-b px-4 py-2">
              <TabsList>
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="px-3">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <Overview stats={stats} />
              <Flow stats={stats} />
              <Status stats={stats} />
              <People stats={stats} />
              <Categories stats={stats} />
              <Times stats={stats} />
              <Risks stats={stats} onIssueSelect={onIssueSelect} />
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
