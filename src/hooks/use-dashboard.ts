import { useAttentionStatus } from "@/hooks/attention/use-attention-status";
import { useDeviceOnline } from "@/hooks/connections/use-device-online";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { dashboardFreshness, freshnessSource } from "@/lib/dashboard-freshness";
import {
  useJiraLogin,
  useJiraMyWork,
  useJiraMyself,
  useJiraProjects,
  type JiraWorkIssue,
} from "@/lib/jira/queries";
import { useProjectPrefs } from "@/hooks/use-project-prefs";
import { workdayGreeting } from "@/lib/workday";
import { useResumeWork } from "@/hooks/use-resume-work";
import { useTodayAgenda } from "@/hooks/use-today-agenda";

export function useDashboard() {
  const session = useJiraSession();
  const myself = useJiraMyself();
  const work = useJiraMyWork();
  const projects = useJiraProjects();
  const login = useJiraLogin();
  const attention = useAttentionStatus();
  const resume = useResumeWork();
  const { favoriteIds } = useProjectPrefs();
  const online = useDeviceOnline();
  const showsFavorites = favoriteIds.length > 0;
  const now = new Date();
  const firstName = myself.data?.displayName.split(" ")[0];
  const issues = work.data?.issues ?? [];
  const active = issues.filter((issue) => issue.fields.status.statusCategory.key === "indeterminate");
  const next = issues.filter((issue) => issue.fields.status.statusCategory.key === "new");
  const done = issues.filter((issue) => issue.fields.status.statusCategory.key === "done");
  const open = [...active, ...next];
  const agenda = useTodayAgenda({ active, open });
  const groups = new Map<string, JiraWorkIssue[]>();
  for (const issue of open)
    groups.set(issue.fields.project.key, [...(groups.get(issue.fields.project.key) ?? []), issue]);
  const loadGroups = [...groups.values()]
    .sort((a, b) => b.length - a.length)
    .map((group) => {
      const activeCount = group.filter((issue) => issue.fields.status.statusCategory.key === "indeterminate").length;
      return {
        project: group[0]!.fields.project,
        count: group.length,
        activeCount,
      };
    });
  const freshness = dashboardFreshness({
    primary: freshnessSource("Tickets", work),
    secondary: [freshnessSource("Profil", myself), ...(showsFavorites ? [freshnessSource("Favoriten", projects)] : [])],
    online,
  });
  const refresh = () => {
    if (session.status !== "connected" || (freshness.kind === "ready" && freshness.refreshing)) return;
    void work.refetch({ cancelRefetch: false });
    void myself.refetch({ cancelRefetch: false });
    if (showsFavorites) void projects.refetch({ cancelRefetch: false });
  };
  return {
    session,
    login,
    attention,
    resume,
    agenda,
    freshness,
    refresh,
    now,
    active,
    next,
    done,
    open,
    loadGroups,
    greeting: `${workdayGreeting(now.getHours())}${firstName ? `, ${firstName}` : ""}.`,
    dateLabel: now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }),
    favorites: projects.data?.filter((project) => favoriteIds.includes(project.id)) ?? [],
  };
}

export type DashboardState = ReturnType<typeof useDashboard>;
