import type { ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowRightIcon, LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { AttentionBriefing } from "@/components/attention/attention-briefing";
import { IssueStatusMenu } from "@/components/issue-status-menu";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import {
  type JiraWorkIssue,
  useJiraLogin,
  useJiraLogout,
  useJiraMyWork,
  useJiraMyself,
  useJiraProjects,
  useJiraSite,
} from "@/lib/jira/queries";
import { useAttentionStatus } from "@/hooks/attention/use-attention-status";
import { useProjectPrefs } from "@/lib/project-prefs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Home,
});

const reveal = "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 motion-reduce:animate-none";

function greeting(hour: number) {
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

function Home() {
  const site = useJiraSite();
  if (site.isPending) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  return site.data ? <Dashboard siteName={site.data.siteName} /> : <Welcome />;
}

function Welcome() {
  const login = useJiraLogin();
  return (
    <div className="relative grid h-full place-items-center overflow-hidden px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black,transparent_70%)] bg-size-[3rem_3rem]"
      />
      <div className={cn("relative flex max-w-xl flex-col items-start gap-8", reveal)}>
        <img src="/logo.svg" alt="" className="size-14" />
        <h1 className="text-5xl font-semibold tracking-tight text-balance">
          Jira, aber nur das,
          <br />
          <span className="text-muted-foreground">was heute zählt.</span>
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Verbinde deinen Atlassian-Account. betterjira zeigt dir danach, woran du gerade arbeitest, was als
          Nächstes kommt und wo deine Arbeit liegt.
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
    </div>
  );
}

function Dashboard({ siteName }: { siteName: string }) {
  const myself = useJiraMyself();
  const work = useJiraMyWork();
  const logout = useJiraLogout();
  const attention = useAttentionStatus();
  const now = new Date();
  const firstName = myself.data?.displayName.split(" ")[0];

  const issues = work.data?.issues ?? [];
  const active = issues.filter((issue) => issue.fields.status.statusCategory.key === "indeterminate");
  const next = issues.filter((issue) => issue.fields.status.statusCategory.key === "new");
  const done = issues.filter((issue) => issue.fields.status.statusCategory.key === "done");
  const open = [...active, ...next];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-8 py-10 lg:px-12">
      <header className={cn("flex flex-wrap items-end justify-between gap-6", reveal)}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            {now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })} · {siteName}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            {greeting(now.getHours())}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
          {work.data && (
            <p className="max-w-2xl text-xl text-balance text-muted-foreground">
              <Figure value={active.length}>in Arbeit</Figure>, <Figure value={next.length}>als Nächstes</Figure>{" "}
              und <Figure value={done.length}>diese Woche erledigt</Figure>.
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOutIcon />
          Abmelden
        </Button>
      </header>

      <div className={cn(reveal, "delay-75")}>
        <AttentionBriefing {...attention} onRun={attention.run} />
      </div>

      {work.error ? (
        <p role="alert" className="text-sm text-destructive">
          {work.error.message}
        </p>
      ) : !work.data ? (
        <div className="flex flex-col gap-3" aria-busy>
          <Skeleton className="h-3 w-full" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          {open.length > 0 && <LoadMap issues={open} />}
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex flex-col gap-10">
              <IssueSection title="Jetzt" hint="Status in Arbeit" issues={active} accent />
              <IssueSection title="Als Nächstes" hint="Offen, dir zugewiesen" issues={next} />
              {open.length === 0 && (
                <p className="text-muted-foreground">Nichts Offenes auf deinem Tisch. Genieß den Moment.</p>
              )}
            </div>
            <aside className="flex flex-col gap-10">
              <Favorites />
              <IssueSection title="Erledigt" hint="Letzte 7 Tage" issues={done} compact />
            </aside>
          </div>
        </>
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

function LoadMap({ issues }: { issues: JiraWorkIssue[] }) {
  const groups = new Map<string, JiraWorkIssue[]>();
  for (const issue of issues) groups.set(issue.fields.project.key, [...(groups.get(issue.fields.project.key) ?? []), issue]);
  const byProject = [...groups.values()].sort((a, b) => b.length - a.length);

  return (
    <section aria-labelledby="load-title" className={cn("flex flex-col gap-3", reveal, "delay-100")}>
      <h2 id="load-title" className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        Wo deine Arbeit liegt
      </h2>
      <ul className="flex h-14 gap-1">
        {byProject.map((group) => {
          const project = group[0]!.fields.project;
          const activeCount = group.filter((i) => i.fields.status.statusCategory.key === "indeterminate").length;
          return (
            <li key={project.key} style={{ flexGrow: group.length }} className="min-w-10 basis-0">
              <Link
                to="/bereiche/$key"
                params={{ key: project.key }}
                title={`${project.name}: ${group.length} offen, ${activeCount} in Arbeit`}
                className="group flex h-full flex-col justify-between overflow-hidden rounded-md bg-muted px-2.5 py-1.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-mono text-muted-foreground group-hover:text-foreground">
                    {project.key}
                  </span>
                  <span className="font-medium tabular-nums">{group.length}</span>
                </span>
                <span aria-hidden className="h-1 overflow-hidden rounded-full bg-background">
                  <span
                    className="block h-full rounded-full bg-sidebar-primary"
                    style={{ width: `${(activeCount / group.length) * 100}%` }}
                  />
                </span>
              </Link>
            </li>
          );
        })}
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
  if (issues.length === 0) return null;
  return (
    <section className={cn("flex flex-col gap-2", reveal, "delay-200")}>
      <h2 className="flex items-baseline gap-2 border-b pb-2">
        {accent && <span aria-hidden className="size-2 translate-y-[-1px] rounded-full bg-sidebar-primary" />}
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground tabular-nums">{issues.length}</span>
        <span className="ml-auto text-xs text-muted-foreground">{hint}</span>
      </h2>
      <ul className="-mx-2 flex flex-col">
        {issues.map((issue) => (
          <li
            key={issue.id}
            className={cn(
              "group relative grid w-full items-baseline gap-x-4 rounded-md px-2 py-2 transition-colors hover:bg-muted has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring",
              compact ? "grid-cols-[1fr]" : "grid-cols-[6rem_minmax(0,1fr)_auto]",
            )}
          >
            <span className={cn("font-mono text-xs text-muted-foreground", compact && "hidden")}>{issue.key}</span>
            <Link
              to="/issue/$key"
              params={{ key: issue.key }}
              className={cn(
                "truncate outline-none after:absolute after:inset-0 after:rounded-md",
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
              <IssueStatusMenu issueKey={issue.key} status={issue.fields.status} className="relative z-10 hidden md:inline-flex" />
              <span className="w-24 text-right tabular-nums">
                {formatDistanceToNowStrict(new Date(issue.fields.updated), { locale: de, addSuffix: true })}
              </span>
              <ArrowRightIcon className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-has-[a:focus-visible]:opacity-100" />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Favorites() {
  const projects = useJiraProjects();
  const favoriteIds = useProjectPrefs((state) => state.projectIds);
  const favorites = projects.data?.filter((project) => favoriteIds.includes(project.id)) ?? [];

  return (
    <section className={cn("flex flex-col gap-2", reveal, "delay-150")}>
      <h2 className="border-b pb-2 font-medium">Favoriten</h2>
      {favorites.length === 0 ? (
        <p className="text-sm text-muted-foreground">Markiere Bereiche per Rechtsklick in der Seitenleiste als Favorit.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {favorites.map((project) => (
            <li key={project.id}>
              <Link
                to="/bereiche/$key"
                params={{ key: project.key }}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ProjectAvatar project={project} className="size-5" />
                <span className="truncate">{project.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
