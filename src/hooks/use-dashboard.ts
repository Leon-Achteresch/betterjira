import { useAttentionStatus } from "@/hooks/attention/use-attention-status";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import {
  useJiraLogin,
  useJiraMyWork,
  useJiraMyself,
  useJiraProjects,
  type JiraWorkIssue,
} from "@/lib/jira/queries";
import { useProjectPrefs } from "@/lib/project-prefs";
import { workdayGreeting } from "@/lib/workday";

export function useDashboard() {
  const session = useJiraSession();
  const myself = useJiraMyself();
  const work = useJiraMyWork();
  const projects = useJiraProjects();
  const login = useJiraLogin();
  const attention = useAttentionStatus();
  const favoriteIds = useProjectPrefs((state) => state.projectIds);
  const now = new Date();
  const firstName = myself.data?.displayName.split(" ")[0];
  const issues = work.data?.issues ?? [];
  const active = issues.filter((issue) => issue.fields.status.statusCategory.key === "indeterminate");
  const next = issues.filter((issue) => issue.fields.status.statusCategory.key === "new");
  const done = issues.filter((issue) => issue.fields.status.statusCategory.key === "done");
  const open = [...active, ...next];
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
        fraction: activeCount / group.length,
      };
    });
  return {
    session,
    login,
    attention,
    work,
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
