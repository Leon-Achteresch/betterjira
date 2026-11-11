import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, CircleAlertIcon, SearchIcon, WifiOffIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { ResumeWork } from "@/components/dashboard/resume-work";
import { TodayAgenda } from "@/components/dashboard/today-agenda";
import { AttentionBriefing } from "@/components/attention/attention-briefing";
import { IssueStatusMenu } from "@/components/issue-status-menu";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { SessionGate } from "@/components/shell/session-gate";
import type { JiraProject, JiraWorkIssue } from "@/lib/jira/queries";
import type { DashboardState } from "@/hooks/use-dashboard";
import { useDashboardIssues } from "@/hooks/use-dashboard-issues";
import { SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

export function Workday({ dashboard }: { dashboard: DashboardState }) {
  return (
    <SessionGate
      session={dashboard.session}
      className="flex h-full flex-col"
      pending={<DashboardSkeleton />}
      unconnected={<Welcome login={dashboard.login} />}
    >
      <Dashboard dashboard={dashboard} />
    </SessionGate>
  );
}

function Welcome({ login }: { login: DashboardState["login"] }) {
  return (
    <div className="grid min-h-full place-items-center px-6 py-10">
      <Fade>
        <div className="glass-card flex max-w-xl flex-col items-start gap-6 rounded-2xl p-6 sm:p-10">
          <img src="/logo.svg" alt="" className="size-14" />
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Jira, aber nur das,
            <br />
            <span className="text-muted-foreground">was heute zählt.</span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Verbinde deinen Atlassian-Account. betterjira zeigt dir danach, woran du gerade arbeitest, was als Nächstes
            kommt und wo deine Arbeit liegt.
          </p>
          <Button size="lg" onClick={() => login.mutate()}>
            {login.isPending && <Spinner />}
            {login.isPending ? "Warte auf Browser – erneut öffnen" : "Mit Atlassian verbinden"}
          </Button>
          {login.error && (
            <p role="alert" className="text-sm text-destructive">
              {login.error.message}
            </p>
          )}
        </div>
      </Fade>
    </div>
  );
}

function Dashboard({ dashboard }: { dashboard: DashboardState }) {
  const { freshness, attention, active, next, done, open } = dashboard;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs text-muted-foreground tabular-nums">
            {dashboard.dateLabel} · {dashboard.session.site?.siteName}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{dashboard.greeting}</h1>
          {freshness.kind === "ready" && (
            <p className="text-sm text-muted-foreground">
              <Figure value={active.length}>in Arbeit</Figure> · <Figure value={next.length}>als Nächstes</Figure> ·{" "}
              <Figure value={done.length}>diese Woche erledigt</Figure>
            </p>
          )}
        </div>
        {freshness.kind === "ready" && (
          <RefreshStatus
            tone={freshness.tone}
            updatedAt={freshness.updatedAt}
            failed={freshness.failed}
            now={dashboard.now}
            onRefresh={dashboard.refresh}
          />
        )}
      </header>

      <ResumeWork item={dashboard.resume} />

      {freshness.kind === "error" ? (
        <LoadProblem
          icon={<CircleAlertIcon className="size-4 shrink-0 text-destructive" />}
          title="Deine Tickets konnten nicht geladen werden."
          detail={freshness.message}
          onRetry={dashboard.refresh}
        />
      ) : freshness.kind === "waiting" ? (
        <LoadProblem
          icon={<WifiOffIcon className="size-4 shrink-0 text-warning" />}
          title="Offline: Deine Tickets werden geladen, sobald die Verbindung zurück ist."
          detail="Bisher wurde in dieser Sitzung noch kein Stand geladen."
        />
      ) : freshness.kind === "loading" ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="glass-card flex min-w-0 flex-col gap-6 rounded-2xl p-4 sm:p-5">
              <IssueSection title="Jetzt" hint="Status in Arbeit" issues={active} accent />
              <IssueSection title="Als Nächstes" hint="Offen, dir zugewiesen" issues={next} />
              {open.length === 0 && (
                <div className="flex flex-col items-start gap-3 py-3">
                  <p className="text-sm text-muted-foreground">Nichts Offenes auf deinem Tisch. Genieß den Moment.</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/tickets"><SearchIcon />Tickets durchsuchen</Link>
                  </Button>
                </div>
              )}
            </div>
            <AttentionBriefing {...attention} onRun={attention.run} />
            {dashboard.loadGroups.length > 1 && <LoadMap groups={dashboard.loadGroups} />}
          </div>
          <aside aria-label="Tagesübersicht" className="flex min-w-0 flex-col gap-5">
            <TodayAgenda {...dashboard.agenda} />
            <Favorites favorites={dashboard.favorites} />
            {done.length > 0 && (
              <div className="glass-card rounded-2xl p-4">
                <IssueSection title="Erledigt" hint="Letzte 7 Tage" issues={done} compact />
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-5" aria-busy aria-label="Arbeitsübersicht wird geladen">
      <Skeleton className="h-5 w-48 rounded-xl" />
      <Skeleton className="h-8 w-64 max-w-full rounded-xl" />
      <div className="glass-card flex flex-col gap-3 rounded-2xl p-4">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-10 w-full rounded-xl" />)}
      </div>
    </div>
  );
}

function LoadProblem({
  icon,
  title,
  detail,
  onRetry,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="glass-card flex flex-wrap items-start gap-3 rounded-2xl px-4 py-3.5">
      {icon}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-medium text-balance">{title}</p>
        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Erneut versuchen
        </Button>
      )}
    </div>
  );
}

function Figure({ value, children }: { value: number; children: ReactNode }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-medium text-foreground tabular-nums">{value}</span> {children}
    </span>
  );
}

function LoadMap({ groups }: { groups: DashboardState["loadGroups"] }) {
  return (
    <section aria-labelledby="load-title" className="flex flex-col gap-2">
      <h2 id="load-title" className="text-xs font-medium text-muted-foreground">Wo deine Arbeit liegt</h2>
      <ul className="flex flex-wrap gap-2">
        {groups.map(({ project, count, activeCount }) => (
          <li key={project.key}>
            <Link
              to="/bereiche/$key"
              params={{ key: project.key }}
              title={`${project.name}: ${count} offen, ${activeCount} in Arbeit`}
              className="flex min-h-8 items-center gap-2 rounded-xl bg-muted/60 px-3 text-xs outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-mono text-muted-foreground">{project.key}</span>
              <span className="font-medium tabular-nums">{count} offen</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function IssueSection({
  title,
  hint,
  issues,
  accent,
  compact,
}: {
  title: string;
  hint: string;
  issues: JiraWorkIssue[];
  accent?: boolean;
  compact?: boolean;
}) {
  const disclosure = useDashboardIssues(issues, compact);
  const reduce = useReducedMotion();
  if (issues.length === 0) return null;
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h2 className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border/60 pb-2">
        {accent && <span aria-hidden className="size-2 translate-y-[-1px] rounded-full bg-sidebar-primary" />}
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground tabular-nums">{issues.length}</span>
        <span className="ml-auto text-xs text-muted-foreground">{hint}</span>
      </h2>
      <Stagger role="list" aria-label={title} className="-mx-2 flex flex-col">
        {disclosure.rows.map(({ issue, updatedLabel }) => (
          <StaggerItem
            role="listitem"
            key={issue.id}
            className={cn(
              "group relative grid min-h-12 w-full items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2 transition-colors hover:bg-muted has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring",
              compact ? "grid-cols-[1fr]" : "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[5.5rem_minmax(0,1fr)_auto]",
            )}
          >
            <span className={cn("col-span-2 font-mono text-xs text-muted-foreground sm:col-span-1", compact && "hidden")}>{issue.key}</span>
            <Link
              to="/issue/$key"
              params={{ key: issue.key }}
              data-row-link
              className={cn(
                "line-clamp-2 min-w-0 text-sm outline-none after:absolute after:inset-0 after:rounded-xl",
                compact && "text-sm text-muted-foreground line-through decoration-border",
              )}
            >
              {issue.fields.summary}
            </Link>
            <span
              className={cn(
                "flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap",
                compact && "hidden",
              )}
            >
              <IssueStatusMenu
                issueKey={issue.key}
                status={issue.fields.status}
                className="relative z-10 hidden md:inline-flex"
              />
              <span className="hidden w-24 text-right tabular-nums lg:block">
                {updatedLabel}
              </span>
              <ArrowRightIcon className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-has-[a:focus-visible]:opacity-100" />
            </span>
          </StaggerItem>
        ))}
      </Stagger>
      {disclosure.canExpand && (
        <motion.div whileTap={reduce ? undefined : { scale: 0.98 }} transition={SPRING_PRESS} className="self-start">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={disclosure.toggle}>
            {disclosure.expanded ? "Weniger anzeigen" : `Alle ${issues.length} anzeigen`}
          </Button>
        </motion.div>
      )}
    </section>
  );
}

function Favorites({ favorites }: { favorites: JiraProject[] }) {
  if (!favorites.length) return null;
  return (
    <section className="glass-card flex flex-col gap-2 rounded-2xl p-4">
      <h2 className="border-b border-border/60 pb-2 font-medium">Favoriten</h2>
      <ul className="-mx-2 flex flex-col">
        {favorites.map((project) => (
          <li key={project.id}>
            <Link
              to="/bereiche/$key"
              params={{ key: project.key }}
              className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ProjectAvatar project={project} className="size-5" />
              <span className="truncate">{project.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
