import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { openUrl } from "@tauri-apps/plugin-opener";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import {
  ExternalLinkIcon,
  FileTextIcon,
  FolderKanbanIcon,
  FunnelIcon,
  HomeIcon,
  LayersIcon,
  SparklesIcon,
  LogInIcon,
  LogOutIcon,
  PanelLeftIcon,
  SearchIcon,
  SettingsIcon,
  SquareKanbanIcon,
  StarIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { AdfContent } from "@/components/adf-content";
import { JiraStatusBadge } from "@/components/jira-status-badge";
import { JiraUserLabel } from "@/components/jira-user-avatar";
import { CommandPalette, type CommandItem } from "@/components/motion/command-palette";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useSidebar } from "@/components/ui/sidebar";
import {
  useJiraFilters,
  useJiraIssue,
  useJiraIssues,
  useJiraLogin,
  useJiraLogout,
  useJiraMyWork,
  useJiraProjectBoards,
  useJiraProjects,
  useJiraSite,
  type JiraProject,
} from "@/lib/jira/queries";
import { SPRING_PRESS } from "@/lib/ease";
import { IS_MAC } from "@/lib/platform";
import { useProjectPrefs } from "@/lib/project-prefs";

const MOD = IS_MAC ? "⌘" : "Strg";
const ISSUE_KEY = /^[a-z][a-z0-9_]*-\d+$/i;

function IssuePreview({ issueKey }: { issueKey: string }) {
  const issue = useJiraIssue(issueKey);
  if (issue.isPending) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (!issue.data) return <p className="text-sm text-muted-foreground">Vorgang {issueKey} nicht gefunden.</p>;
  const { fields } = issue.data;
  const assignee = fields.assignee as Parameters<typeof JiraUserLabel>[0]["user"];
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{issue.data.key}</span>
        <span>·</span>
        <span className="truncate">{fields.issuetype.name}</span>
      </div>
      <h3 className="text-sm font-semibold leading-snug text-foreground">{fields.summary}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <JiraStatusBadge status={fields.status} />
        <span className="truncate text-xs text-muted-foreground">{fields.project.name}</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <JiraUserLabel user={assignee} />
      </div>
      <p className="text-xs text-muted-foreground">
        Aktualisiert {formatDistanceToNowStrict(new Date(fields.updated), { locale: de, addSuffix: true })}
      </p>
      {fields.description ? (
        <div className="relative max-h-40 overflow-hidden text-muted-foreground [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
          <AdfContent doc={fields.description} className="gap-2 text-xs" />
        </div>
      ) : null}
    </div>
  );
}

function ProjectPreview({ project }: { project: JiraProject }) {
  const boards = useJiraProjectBoards(project.key);
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <ProjectAvatar project={project} size="lg" />
        <div className="grid min-w-0">
          <span className="truncate text-sm font-semibold text-foreground">{project.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{project.key}</span>
        </div>
      </div>
      <div className="grid gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Boards</span>
        {boards.isPending ? (
          <Skeleton className="h-5 w-2/3" />
        ) : boards.data?.values.length ? (
          boards.data.values.map((board) => (
            <span key={board.id} className="flex items-center gap-2 text-xs text-foreground">
              <SquareKanbanIcon className="size-3.5 text-muted-foreground" />
              <span className="truncate">{board.name}</span>
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Keine Boards</span>
        )}
      </div>
    </div>
  );
}

function FilterPreview({ id, name }: { id: string; name: string }) {
  const issues = useJiraIssues(`filter = ${id}`);
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <FunnelIcon className="size-4 text-muted-foreground" />
        <span className="truncate text-sm font-semibold text-foreground">{name}</span>
      </div>
      {issues.isPending ? (
        <div className="grid gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : issues.error ? (
        <p className="text-xs text-destructive">Filter konnte nicht geladen werden</p>
      ) : issues.data?.issues.length ? (
        <div className="grid gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {issues.data.issues.length >= 50 ? "50+" : issues.data.issues.length} Vorgänge
          </span>
          {issues.data.issues.slice(0, 6).map((issue) => (
            <div key={issue.id} className="grid gap-0.5 rounded-md bg-background px-2 py-1.5 ring-1 ring-border">
              <span className="truncate text-xs text-foreground">{issue.fields.summary}</span>
              <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                {issue.key}
                <span className="truncate font-sans">{issue.fields.status.name}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Keine Vorgänge</p>
      )}
    </div>
  );
}

function IssueKey({ value }: { value: string }) {
  return <span className="font-mono text-[10px] text-muted-foreground">{value}</span>;
}

export function AppCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced] = useDebouncedValue(query.trim(), { wait: 250 });
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();
  const site = useJiraSite();
  const projects = useJiraProjects();
  const filters = useJiraFilters();
  const myWork = useJiraMyWork();
  const login = useJiraLogin();
  const logout = useJiraLogout();
  const hiddenIds = useProjectPrefs((state) => state.hiddenProjectIds);
  const favoriteIds = useProjectPrefs((state) => state.projectIds);

  const text = debounced.replace(/[\\"]/g, "\\$&");
  const search = useJiraIssues(`text ~ "${text}*" ORDER BY updated DESC`, open && debounced.length >= 2);
  const trimmed = query.trim();
  const issueKey = ISSUE_KEY.test(trimmed) ? trimmed.toUpperCase() : null;

  const openIssue = (key: string) => void navigate({ to: "/issue/$key", params: { key } });
  const workKeys = new Set(myWork.data?.issues.map((issue) => issue.key));

  const items: CommandItem[] = [
    ...(issueKey
      ? [
          {
            id: `key:${issueKey}`,
            label: `${issueKey} öffnen`,
            group: "Vorgang",
            icon: FileTextIcon,
            keywords: [trimmed],
            preview: <IssuePreview issueKey={issueKey} />,
            onSelect: () => openIssue(issueKey),
          },
        ]
      : []),
    ...(search.data?.issues ?? [])
      .filter((issue) => !workKeys.has(issue.key) && issue.key !== issueKey)
      .map((issue) => ({
        id: `search:${issue.key}`,
        label: issue.fields.summary,
        group: "Suchergebnisse",
        icon: FileTextIcon,
        keywords: [debounced, issue.key],
        badge: <IssueKey value={issue.key} />,
        preview: <IssuePreview issueKey={issue.key} />,
        onSelect: () => openIssue(issue.key),
      })),
    ...(myWork.data?.issues ?? []).map((issue) => ({
      id: `work:${issue.key}`,
      label: issue.fields.summary,
      group: "Meine Vorgänge",
      icon: FileTextIcon,
      keywords: [issue.key, issue.fields.project.name, issue.fields.status.name],
      badge: <IssueKey value={issue.key} />,
      preview: <IssuePreview issueKey={issue.key} />,
      onSelect: () => openIssue(issue.key),
    })),
    ...(projects.data ?? [])
      .filter((project) => !hiddenIds.includes(project.id))
      .sort((a, b) => Number(favoriteIds.includes(b.id)) - Number(favoriteIds.includes(a.id)))
      .map((project) => ({
        id: `project:${project.id}`,
        label: project.name,
        group: "Bereiche",
        icon: FolderKanbanIcon,
        keywords: [project.key],
        badge: favoriteIds.includes(project.id) ? <StarIcon className="size-3 fill-amber-400 text-amber-400" /> : undefined,
        preview: <ProjectPreview project={project} />,
        onSelect: () => void navigate({ to: "/bereiche/$key", params: { key: project.key }, search: {} }),
      })),
    ...[...(filters.data ?? [])]
      .sort((a, b) => Number(!!b.favourite) - Number(!!a.favourite))
      .map((filter) => ({
        id: `filter:${filter.id}`,
        label: filter.name,
        group: "Filter",
        icon: FunnelIcon,
        badge: filter.favourite ? <StarIcon className="size-3 fill-amber-400 text-amber-400" /> : undefined,
        preview: <FilterPreview id={filter.id} name={filter.name} />,
        onSelect: () => void navigate({ to: "/filter/$id", params: { id: filter.id } }),
      })),
    { id: "nav:home", label: "Startseite", group: "Navigation", icon: HomeIcon, keywords: ["home", "dashboard"], onSelect: () => void navigate({ to: "/" }) },
    { id: "nav:settings", label: "Einstellungen", group: "Navigation", icon: SettingsIcon, onSelect: () => void navigate({ to: "/settings" }) },
    { id: "nav:areas", label: "Bereiche verwalten", group: "Navigation", icon: LayersIcon, onSelect: () => void navigate({ to: "/settings/bereiche" }) },
    { id: "nav:briefing", label: "KI-Briefing einrichten", group: "Navigation", icon: SparklesIcon, onSelect: () => void navigate({ to: "/settings/briefing" }) },
    { id: "action:sidebar", label: "Seitenleiste ein-/ausblenden", group: "Aktionen", icon: PanelLeftIcon, hint: `${MOD} B`, onSelect: toggleSidebar },
    ...(site.data
      ? [
          { id: "action:jira", label: "Jira im Browser öffnen", group: "Aktionen", icon: ExternalLinkIcon, onSelect: () => void openUrl(site.data!.siteUrl) },
          { id: "action:logout", label: "Abmelden", group: "Aktionen", icon: LogOutIcon, onSelect: () => logout.mutate() },
        ]
      : [{ id: "action:login", label: "Mit Atlassian verbinden", group: "Aktionen", icon: LogInIcon, onSelect: () => login.mutate() }]),
  ];

  return (
    <>
      <motion.button
        type="button"
        data-tauri-drag-region="false"
        onClick={() => setOpen(true)}
        whileHover={reduce ? undefined : { y: -1 }}
        whileTap={reduce ? undefined : { scale: 0.98 }}
        transition={SPRING_PRESS}
        className="group mx-3 flex h-7 w-full max-w-sm min-w-0 items-center gap-2 rounded-lg bg-sidebar-accent/60 px-2.5 text-sm text-muted-foreground ring-1 ring-transparent transition-colors hover:bg-sidebar-accent hover:text-foreground hover:ring-border"
      >
        <SearchIcon className="size-3.5 shrink-0" />
        <span className="flex-1 truncate text-left">Suchen…</span>
        <kbd className="hidden shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] sm:inline-block">
          {MOD} K
        </kbd>
      </motion.button>
      <CommandPalette
        items={items}
        open={open}
        onOpenChange={setOpen}
        onQueryChange={setQuery}
        loading={open && debounced.length >= 2 && search.isFetching}
        placeholder="Vorgänge, Bereiche, Filter oder Befehle suchen…"
      />
    </>
  );
}
